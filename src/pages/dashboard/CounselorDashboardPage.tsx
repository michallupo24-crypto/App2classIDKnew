import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart, AlertTriangle, Lock, Users, Brain, MessageSquare,
  Shield, TrendingDown, CheckCircle2, Plus, Search, Eye, EyeOff
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AvatarPreview from "@/components/avatar/AvatarPreview";

const CounselorDashboardPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [tab, setTab] = useState("flagged");
  const [flaggedStudents, setFlaggedStudents] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [caseNote, setCaseNote] = useState("");
  const [caseStatus, setCaseStatus] = useState("active");
  const [teacherGuidance, setTeacherGuidance] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadFlaggedStudents();
    loadCases();
  }, [profile.id]);

  const loadFlaggedStudents = async () => {
    // Students flagged by teachers
    const { data: flagged } = await supabase
      .from("student_flags")
      .select("*, profiles!student_id(id, full_name, class_id, classes(grade, class_number))")
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    // Also get AI-detected at-risk students (high absences + low grades)
    const { data: atRisk } = await supabase.rpc("get_at_risk_students").limit(10);

    setFlaggedStudents([...(flagged || []), ...(atRisk || [])]);
  };

  const loadCases = async () => {
    const { data } = await supabase
      .from("counselor_cases")
      .select("*, profiles!student_id(id, full_name, class_id, classes(grade, class_number))")
      .eq("counselor_id", profile.id)
      .order("updated_at", { ascending: false });
    setCases(data || []);
  };

  const openCase = async (studentId: string, studentName: string) => {
    const { data, error } = await supabase.from("counselor_cases").upsert({
      student_id: studentId,
      counselor_id: profile.id,
      status: "active",
      notes: [],
    }).select().single();
    if (!error) {
      setSelectedStudent({ id: studentId, full_name: studentName, caseId: data.id });
      setShowDetails(true);
      toast({ title: `תיק נפתח עבור ${studentName}` });
    }
  };

  const addNote = async () => {
    if (!selectedStudent?.caseId || !caseNote) return;
    const { data: existing } = await supabase.from("counselor_cases")
      .select("notes").eq("id", selectedStudent.caseId).single();
    const notes = [...(existing?.notes || []), {
      date: new Date().toISOString(),
      text: caseNote,
      counselor: profile.full_name,
    }];
    await supabase.from("counselor_cases").update({ notes, status: caseStatus, updated_at: new Date().toISOString() })
      .eq("id", selectedStudent.caseId);
    setCaseNote("");
    toast({ title: "הערה נשמרה בתיק המוצפן 🔒" });
    loadCases();
  };

  const sendTeacherGuidance = async () => {
    if (!selectedStudent || !teacherGuidance) return;
    await supabase.from("teacher_guidance").insert({
      student_id: selectedStudent.id,
      counselor_id: profile.id,
      guidance: teacherGuidance,
      is_confidential: true,
    });
    setTeacherGuidance("");
    toast({ title: "הנחיה נשלחה למחנך/ת (ללא חשיפת פרטים רפואיים) ✅" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-warning/10 text-warning border-warning/30";
      case "monitoring": return "bg-info/10 text-info border-info/30";
      case "external": return "bg-destructive/10 text-destructive border-destructive/30";
      case "resolved": return "bg-success/10 text-success border-success/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => ({
    active: "בטיפול פעיל", monitoring: "במעקב", external: "הועבר לגורם חיצוני", resolved: "סגור"
  }[status] || status);

  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="space-y-6" dir="rtl">

      <motion.div variants={item} className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Heart className="h-7 w-7 text-destructive" /> מרכז הייעוץ
        </h1>
        <Badge variant="outline" className="gap-1"><Lock className="h-3.5 w-3.5" /> מוצפן ומאובטח</Badge>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{flaggedStudents.length}</p>
            <p className="text-[10px] text-muted-foreground">דורשים תשומת לב</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">{cases.filter(c => c.status === "active").length}</p>
            <p className="text-[10px] text-muted-foreground">תיקים פעילים</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{cases.filter(c => c.status === "resolved").length}</p>
            <p className="text-[10px] text-muted-foreground">סגורים החודש</p>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="flagged" className="font-heading text-xs">
            סימון AI <Badge variant="destructive" className="mr-1 text-[10px]">{flaggedStudents.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="cases" className="font-heading text-xs">תיקים פתוחים</TabsTrigger>
          <TabsTrigger value="case-detail" className="font-heading text-xs">תיק פעיל</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Flagged students */}
      {tab === "flagged" && (
        <motion.div variants={item} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            תלמידים שה-AI זיהה שחווים "צניחה רב-מערכתית" (ירידה בציונים + עלייה בחיסורים + ריכוז נמוך)
          </p>
          {flaggedStudents.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">אין תלמידים מסומנים כרגע ✅</CardContent></Card>
          ) : (
            flaggedStudents.map((f: any, i) => (
              <Card key={i} className="border-warning/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <div>
                      <p className="font-heading font-bold text-sm">{f.profiles?.full_name || f.full_name}</p>
                      <p className="text-xs text-muted-foreground">{f.profiles?.classes?.grade}'{f.profiles?.classes?.class_number} | {f.reason || "זוהה ע״י AI"}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs font-heading" onClick={() => openCase(f.profiles?.id || f.id, f.profiles?.full_name || f.full_name)}>
                    פתח תיק
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>
      )}

      {/* Cases */}
      {tab === "cases" && (
        <motion.div variants={item} className="space-y-3">
          {cases.filter(c => c.status !== "resolved").map(c => (
            <Card key={c.id} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => { setSelectedStudent({ ...c.profiles, caseId: c.id }); setTab("case-detail"); }}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-heading font-bold text-sm">{c.profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{(c.notes || []).length} הערות בתיק</p>
                  </div>
                </div>
                <Badge className={`text-xs border ${getStatusColor(c.status)}`}>{getStatusLabel(c.status)}</Badge>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Case detail */}
      {tab === "case-detail" && selectedStudent && (
        <motion.div variants={item} className="space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-heading font-bold">{selectedStudent.full_name}</p>
                <p className="text-xs text-muted-foreground">כל המידע מוצפן ונגיש ליועצת בלבד</p>
              </div>
            </CardContent>
          </Card>

          {/* Status selector */}
          <div className="flex gap-2 flex-wrap">
            {["active", "monitoring", "external", "resolved"].map(s => (
              <button key={s} onClick={() => setCaseStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading border transition-all ${caseStatus === s ? getStatusColor(s) : "border-border text-muted-foreground"}`}>
                {getStatusLabel(s)}
              </button>
            ))}
          </div>

          {/* Add note */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-xs font-heading flex items-center gap-1"><Lock className="h-3 w-3" /> הוספת הערה לתיק (מוצפן)</Label>
              <Textarea value={caseNote} onChange={e => setCaseNote(e.target.value)} rows={3} placeholder="תיעוד שיחה, תצפית, או מהלך טיפולי..." className="text-xs" />
              <Button className="w-full gap-2 font-heading text-xs" onClick={addNote} disabled={!caseNote}>
                <Lock className="h-3.5 w-3.5" /> שמור הערה מוצפנת
              </Button>
            </CardContent>
          </Card>

          {/* Teacher guidance */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-xs font-heading">הנחיה למחנך/ת (ללא פרטים רפואיים)</Label>
              <Textarea value={teacherGuidance} onChange={e => setTeacherGuidance(e.target.value)} rows={2}
                placeholder='למשל: "התלמיד חווה תקופה מורכבת, נא להתחשב בלו"ז המבחנים"' className="text-xs" />
              <Button variant="outline" className="w-full gap-2 font-heading text-xs" onClick={sendTeacherGuidance} disabled={!teacherGuidance}>
                <MessageSquare className="h-3.5 w-3.5" /> שלח למחנך/ת
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default CounselorDashboardPage;
