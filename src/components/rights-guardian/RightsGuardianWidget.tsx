import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Shield, CheckCircle2, AlertTriangle, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";

interface Props {
  profile: UserProfile;
}

const RightsGuardianWidget = ({ profile }: Props) => {
  const { toast } = useToast();
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appealText, setAppealText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAppeal, setShowAppeal] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState("");

  useEffect(() => {
    checkRights();
  }, [profile.id]);

  const checkRights = async () => {
    setLoading(true);
    const results = [];

    // Check 1: Exam material uploaded at least 7 days before
    const { data: upcomingExams } = await supabase
      .from("grade_events")
      .select("event_date, subject, id")
      .eq("event_type", "exam")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(3);

    for (const exam of upcomingExams || []) {
      const daysUntil = differenceInDays(new Date(exam.event_date), new Date());
      const { data: materials } = await supabase
        .from("lesson_files")
        .select("id")
        .eq("subject", exam.subject)
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

      results.push({
        label: `חומר למבחן ${exam.subject} הועלה בזמן`,
        ok: (materials?.length || 0) > 0 || daysUntil > 7,
        detail: daysUntil <= 7 && !materials?.length ? "⚠️ חומר לא הועלה" : `${daysUntil} ימים עד המבחן`,
        violation: daysUntil <= 7 && !materials?.length ? `חומר למבחן ${exam.subject} לא הועלה שבוע לפני המבחן` : null,
      });
    }

    // Check 2: Max 3 exams per week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const { data: thisWeekExams } = await supabase
      .from("grade_events")
      .select("id")
      .eq("event_type", "exam")
      .gte("event_date", weekStart.toISOString());
    const examCount = thisWeekExams?.length || 0;

    results.push({
      label: "לא יותר מ-3 מבחנים בשבוע",
      ok: examCount <= 3,
      detail: `${examCount} מבחנים השבוע`,
      violation: examCount > 3 ? `${examCount} מבחנים בשבוע זה — חריגה מהתקן` : null,
    });

    // Check 3: Grades returned within 14 days
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const { data: pendingGrades } = await supabase
      .from("submissions")
      .select("id, submitted_at, grade")
      .eq("student_id", profile.id)
      .is("grade", null)
      .lt("submitted_at", twoWeeksAgo.toISOString());

    results.push({
      label: "ציונים הוחזרו תוך 14 יום",
      ok: (pendingGrades?.length || 0) === 0,
      detail: pendingGrades?.length ? `${pendingGrades.length} עבודות ממתינות לציון` : "כל הציונים הוחזרו ✅",
      violation: pendingGrades?.length ? `${pendingGrades.length} עבודות ממתינות לציון מעל 14 יום` : null,
    });

    setChecks(results);
    setLoading(false);
  };

  const sendAppeal = async () => {
    if (!appealText) return;
    setSending(true);
    try {
      // Generate professional appeal with AI
      const { data } = await supabase.functions.invoke("ai-tutor", {
        body: {
          message: `נסח פנייה מכובדת ומקצועית בעברית לרכז/ת או להנהלה בנושא: "${selectedViolation}". הפנייה מגיעה מתלמיד/ה. הוסף: "בברכה, ${profile.full_name}"`,
        },
      });
      const appealContent = data?.response || appealText;
      await supabase.from("student_appeals").insert({
        student_id: profile.id,
        violation: selectedViolation,
        appeal_text: appealContent,
        status: "sent",
      });
      toast({ title: "הפנייה נשלחה לרכז/ת ✅" });
      setShowAppeal(false); setAppealText(""); setSelectedViolation("");
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  const violations = checks.filter(c => !c.ok);

  return (
    <Card className={violations.length > 0 ? "border-destructive/30" : "border-success/30"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Shield className="h-4 w-4 text-info" />
          מגן הזכויות שלי
          {violations.length > 0 && <Badge variant="destructive" className="text-[10px]">{violations.length} חריגות</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-xs ${c.ok ? "bg-success/5" : "bg-destructive/5"}`}>
            <span className="font-heading">{c.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{c.detail}</span>
              {c.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive px-2"
                    onClick={() => { setSelectedViolation(c.violation); setShowAppeal(true); }}>
                    הגש פנייה
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {showAppeal && (
          <div className="space-y-2 border-t pt-2 mt-2">
            <p className="text-xs font-heading">פנייה: {selectedViolation}</p>
            <Textarea
              value={appealText}
              onChange={e => setAppealText(e.target.value)}
              placeholder="ה-AI ינסח את הפנייה בצורה מקצועית..."
              rows={2}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowAppeal(false)}>ביטול</Button>
              <Button size="sm" className="flex-1 gap-1 text-xs font-heading" onClick={sendAppeal} disabled={sending}>
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                שלח פנייה
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RightsGuardianWidget;
