import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Clock, Upload, Camera, AlertTriangle, FileText } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const ABSENCE_REASONS = [
  { value: "illness", label: "מחלה" },
  { value: "family", label: "אירוע משפחתי" },
  { value: "military", label: "צו ראשון / מילואים" },
  { value: "youth_movement", label: "פעילות תנועת נוער" },
  { value: "medical", label: "טיפול רפואי" },
  { value: "other", label: "אחר" },
];

const AbsenceJustificationPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [absences, setAbsences] = useState<any[]>([]);
  const [selectedAbsence, setSelectedAbsence] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, justified: 0, unjustified: 0 });

  useEffect(() => {
    loadAbsences();
  }, [profile.id]);

  const loadAbsences = async () => {
    const { data } = await supabase.from("attendance")
      .select("*, lessons(subject, date)")
      .eq("student_id", profile.id)
      .in("status", ["absent", "late"])
      .order("date", { ascending: false });
    setAbsences(data || []);
    const total = data?.length || 0;
    const justified = data?.filter((a: any) => a.is_justified).length || 0;
    setStats({ total, justified, unjustified: total - justified });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `absence-proofs/${profile.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      setProofUrl(urlData.publicUrl);
      toast({ title: "מסמך הועלה ✅" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const submitJustification = async () => {
    if (!selectedAbsence || !reason) { toast({ title: "בחר סיבה", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await supabase.from("absence_justifications").insert({
        attendance_id: selectedAbsence,
        student_id: profile.id,
        reason,
        proof_url: proofUrl,
        status: "pending",
      });
      await supabase.from("attendance").update({ justification_status: "pending" }).eq("id", selectedAbsence);
      toast({ title: "הבקשה נשלחה למחנך/ת ✅ תעודכן כשיאשר/תאשר" });
      setSelectedAbsence(null); setReason(""); setProofUrl(null);
      loadAbsences();
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const absencePercent = Math.round((stats.unjustified / 180) * 100);

  const getStatusBadge = (absence: any) => {
    if (absence.is_justified) return <Badge className="bg-success/10 text-success border-success/30 text-[10px]">✅ מוצדק</Badge>;
    if (absence.justification_status === "pending") return <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">⏳ ממתין</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">❌ לא מוצדק</Badge>;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
        <FileText className="h-7 w-7 text-primary" /> ניהול חיסורים
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">סה"כ חיסורים</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{stats.justified}</p>
            <p className="text-[10px] text-muted-foreground">מוצדקים</p>
          </CardContent>
        </Card>
        <Card className={absencePercent >= 12 ? "bg-destructive/5" : ""}>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${absencePercent >= 15 ? "text-destructive" : absencePercent >= 12 ? "text-warning" : ""}`}>{stats.unjustified}</p>
            <p className="text-[10px] text-muted-foreground">לא מוצדקים</p>
          </CardContent>
        </Card>
      </div>

      {/* 15% warning */}
      {absencePercent >= 12 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div>
              <p className="font-heading font-bold text-sm text-warning">{absencePercent}% חיסורים מסך שנת הלימודים</p>
              <p className="text-xs text-muted-foreground">בגיעה ל-15% יתחיל לרדת ציון לפי תקן משרד החינוך. הצדקת חיסורים עוצרת את הספירה.</p>
              <Progress value={absencePercent} className="mt-2 h-2" />
              <p className="text-[10px] text-muted-foreground mt-1">{absencePercent}% מתוך 15% המרב</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Justification form */}
      {selectedAbsence && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-heading font-bold text-sm">הצדקת החיסור</h3>
            <div className="space-y-1">
              <Label className="text-xs font-heading">סיבת החיסור</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="בחר סיבה" /></SelectTrigger>
                <SelectContent>
                  {ABSENCE_REASONS.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-heading">צרף הוכחה (אישור רופא, צו וכו׳)</Label>
              <input type="file" ref={fileRef} accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" className="w-full gap-2 font-heading text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "מעלה..." : <><Upload className="h-4 w-4" /> העלה מסמך / צלם</>}
              </Button>
              {proofUrl && <p className="text-xs text-success">✅ מסמך הועלה בהצלחה</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedAbsence(null); setReason(""); setProofUrl(null); }}>ביטול</Button>
              <Button className="flex-1 gap-2 font-heading text-xs" onClick={submitJustification} disabled={submitting || !reason}>
                <CheckCircle2 className="h-4 w-4" /> {submitting ? "שולח..." : "שלח להצדקה"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Absences list */}
      <div className="space-y-2">
        {absences.map(a => (
          <Card key={a.id} className={a.is_justified ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-heading font-bold text-sm">
                  {a.status === "absent" ? "חיסור" : "איחור"} — {a.lessons?.subject || "שיעור"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.date ? format(new Date(a.date), "EEEE, d בMMMM", { locale: he }) : "תאריך לא ידוע"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(a)}
                {!a.is_justified && a.justification_status !== "pending" && (
                  <Button size="sm" variant="outline" className="text-xs font-heading" onClick={() => setSelectedAbsence(a.id)}>
                    הצדק
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {absences.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">אין חיסורים רשומים 🎉</CardContent></Card>
        )}
      </div>
    </motion.div>
  );
};

export default AbsenceJustificationPage;
