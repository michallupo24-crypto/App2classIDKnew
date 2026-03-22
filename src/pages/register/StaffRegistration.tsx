import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import RegistrationLayout from "@/components/registration/RegistrationLayout";
import EmailInput from "@/components/registration/EmailInput";
import AvatarStudio, { defaultAvatarConfig, type AvatarConfig } from "@/components/avatar/AvatarStudio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SCHOOLS, GRADES, SUBJECTS } from "@/lib/constants";

const STAFF_ROLES_LIST = [
  { value: "educator", label: "מחנך/ת" },
  { value: "professional_teacher", label: "מורה מקצועי/ת" },
  { value: "subject_coordinator", label: "רכז/ת מקצוע" },
  { value: "grade_coordinator", label: "רכז/ת שכבה" },
  { value: "counselor", label: "יועץ/ת" },
  { value: "management", label: "הנהלה" },
];

interface ClassEntry { grade: string; classNum: string; }
interface GradeEntry { grade: string; }

const StaffRegistration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Role-specific
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassEntry[]>([{ grade: "", classNum: "" }]);
  const [grades, setGradesArr] = useState<GradeEntry[]>([{ grade: "" }]);

  const [avatar, setAvatar] = useState<AvatarConfig>({ ...defaultAvatarConfig, outfit: "blazer", outfitColor: "#1E293B" });
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("schools").select("id, name").then(({ data }) => { if (data) setSchools(data); });
  }, []);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const needsSubject = selectedRoles.some(r => ["professional_teacher", "subject_coordinator"].includes(r));
  const needsGrade = selectedRoles.some(r => ["grade_coordinator", "counselor"].includes(r));
  const needsClass = selectedRoles.some(r => ["educator", "professional_teacher", "subject_coordinator"].includes(r));

  const step1Valid = firstName && lastName && idNumber && phone && email && password.length >= 6
    && school && selectedRoles.length > 0
    && (!needsSubject || subjects.length > 0)
    && (!needsClass || classes.every(c => c.grade && c.classNum));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fullName = `${firstName} ${lastName}`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed");
      const userId = authData.user.id;

      await supabase.from("profiles").update({
        full_name: fullName, phone, id_number: idNumber, school_id: school,
      }).eq("id", userId);

      for (const role of selectedRoles) {
        const roleData: any = { user_id: userId, role };
        if (role === "grade_coordinator") roleData.grade = grades[0]?.grade;
        if (role === "subject_coordinator" || role === "professional_teacher") roleData.subject = subjects[0];
        if (role === "counselor") roleData.grades = grades.map(g => g.grade);
        await supabase.from("user_roles").insert(roleData);
      }

      // Add teacher-class relationships
      if (needsClass) {
        for (const cls of classes.filter(c => c.grade && c.classNum)) {
          const { data: classData } = await supabase.from("classes")
            .select("id").eq("grade", cls.grade).eq("class_number", +cls.classNum).eq("school_id", school).maybeSingle();
          if (classData) {
            await supabase.from("teacher_classes").insert({ user_id: userId, class_id: classData.id });
          }
        }
      }

      // Subject associations
      for (const subject of subjects) {
        await supabase.from("teacher_subjects").insert({ user_id: userId, subject }).catch(() => {});
      }

      await supabase.from("approvals").insert({
        user_id: userId,
        required_role: selectedRoles.includes("management") ? "system_admin" :
                       selectedRoles.includes("educator") ? "grade_coordinator" : "management",
        notes: `${fullName} — ${selectedRoles.join(", ")}`,
      });

      await supabase.from("avatars").insert({
        user_id: userId,
        face_shape: avatar.faceShape, skin_color: avatar.skinColor,
        eye_shape: avatar.eyeShape, eye_color: avatar.eyeColor,
        hair_style: avatar.hairStyle, hair_color: avatar.hairColor,
        outfit: avatar.outfit, outfit_color: avatar.outfitColor,
        expression: avatar.expression, background: avatar.background,
      });

      await supabase.auth.signOut();
      setStep(3);
    } catch (error: any) {
      toast({ title: "שגיאה ברישום", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (step === 3) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background px-4">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
        <CheckCircle2 className="w-24 h-24 text-success mx-auto mb-6" />
        <h2 className="text-3xl font-heading font-bold mb-3">הרישום הושלם! 🎉</h2>
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6">
          <p className="text-sm font-heading text-warning">⏳ ממתין לאישור</p>
          <p className="text-xs text-muted-foreground mt-1">בקשתך תועבר לאישור הגורם המתאים</p>
        </div>
        <button onClick={() => navigate("/")} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-heading font-bold">חזרה לדף הראשי</button>
      </motion.div>
    </div>
  );

  return (
    <RegistrationLayout
      title="רישום איש/ת צוות"
      step={step} totalSteps={3}
      onNext={step === 1 ? () => setStep(2) : handleSubmit}
      onBack={() => setStep(step - 1)}
      nextDisabled={step === 1 ? !step1Valid : false}
      nextLabel={step === 2 ? "סיום רישום" : "המשך"}
      loading={loading}
    >
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-xl font-heading font-bold">פרטים אישיים ותפקיד</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="font-heading text-xs">שם פרטי</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
            <div className="space-y-1"><Label className="font-heading text-xs">שם משפחה</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="font-heading text-xs">תעודת זהות</Label><Input value={idNumber} onChange={e => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 ספרות" dir="ltr" /></div>
          <div className="space-y-1"><Label className="font-heading text-xs">טלפון</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="050-1234567" dir="ltr" /></div>
          <div className="space-y-1"><Label className="font-heading text-xs">דוא"ל</Label><EmailInput value={email} onChange={setEmail} /></div>
          <div className="space-y-1"><Label className="font-heading text-xs">סיסמה</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="לפחות 6 תווים" dir="ltr" /></div>
          <div className="space-y-1">
            <Label className="font-heading text-xs">בית ספר</Label>
            <Select value={school} onValueChange={setSchool}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="בחר בית ספר" /></SelectTrigger>
              <SelectContent>{schools.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <Label className="font-heading text-xs">תפקיד/ים (ניתן לבחור מספר)</Label>
            <div className="grid grid-cols-2 gap-2">
              {STAFF_ROLES_LIST.map(r => (
                <div key={r.value} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${selectedRoles.includes(r.value) ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                  onClick={() => toggleRole(r.value)}>
                  <Checkbox checked={selectedRoles.includes(r.value)} />
                  <span className="text-xs font-heading">{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subject (for teachers/coordinators) */}
          {needsSubject && (
            <div className="space-y-2">
              <Label className="font-heading text-xs">מקצועות הוראה</Label>
              {subjects.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={s} onValueChange={v => { const u = [...subjects]; u[i] = v; setSubjects(u); }}>
                    <SelectTrigger className="h-9 text-xs flex-1"><SelectValue placeholder="בחר מקצוע" /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map(sub => <SelectItem key={sub} value={sub} className="text-xs">{sub}</SelectItem>)}</SelectContent>
                  </Select>
                  {subjects.length > 1 && <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setSubjects([...subjects, ""])}>
                <Plus className="h-3 w-3" /> הוסף מקצוע
              </Button>
            </div>
          )}

          {/* Grade (for coordinators/counselors) */}
          {needsGrade && (
            <div className="space-y-2">
              <Label className="font-heading text-xs">שכבה/ות</Label>
              {grades.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={g.grade} onValueChange={v => { const u = [...grades]; u[i].grade = v; setGradesArr(u); }}>
                    <SelectTrigger className="h-9 text-xs flex-1"><SelectValue placeholder="בחר שכבה" /></SelectTrigger>
                    <SelectContent>{GRADES.map(gr => <SelectItem key={gr} value={gr} className="text-xs">שכבה {gr}׳</SelectItem>)}</SelectContent>
                  </Select>
                  {grades.length > 1 && <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setGradesArr(grades.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setGradesArr([...grades, { grade: "" }])}>
                <Plus className="h-3 w-3" /> הוסף שכבה
              </Button>
            </div>
          )}

          {/* Classes (for teachers) */}
          {needsClass && (
            <div className="space-y-2">
              <Label className="font-heading text-xs">כיתות שאתה מלמד</Label>
              {classes.map((cls, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={cls.grade} onValueChange={v => { const u = [...classes]; u[i].grade = v; setClasses(u); }}>
                    <SelectTrigger className="h-9 text-xs w-28"><SelectValue placeholder="שכבה" /></SelectTrigger>
                    <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g} className="text-xs">{g}׳</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={cls.classNum} onChange={e => { const u = [...classes]; u[i].classNum = e.target.value; setClasses(u); }}
                    placeholder="מס׳ כיתה" className="h-9 text-xs w-24" dir="ltr" type="number" min={1} max={15} />
                  {classes.length > 1 && <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setClasses(classes.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setClasses([...classes, { grade: "", classNum: "" }])}>
                <Plus className="h-3 w-3" /> הוסף כיתה
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="text-xl font-heading font-bold mb-4">עיצוב הדמות שלך 🎨</h3>
          <AvatarStudio config={avatar} onChange={setAvatar} variant="adult" />
        </div>
      )}
    </RegistrationLayout>
  );
};

export default StaffRegistration;
