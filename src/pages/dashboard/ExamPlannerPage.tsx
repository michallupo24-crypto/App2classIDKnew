import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, Send, MessageSquare,
  Sparkles, ChevronDown, ChevronUp, Users, BookOpen, ThumbsUp, ThumbsDown
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUBJECTS, GRADES } from "@/lib/constants";
import { format, addDays, isWeekend, addWeeks } from "date-fns";
import { he } from "date-fns/locale";

// Israeli holidays to avoid
const HOLIDAYS_2026 = [
  "2026-03-14", "2026-03-15", // Purim
  "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05",
  "2026-04-06", "2026-04-07", "2026-04-08", // Pesach
  "2026-04-28", // Yom HaZikaron
  "2026-04-29", // Yom HaAtzmaut
  "2026-05-22", // Shavuot
];

// Heavy subjects that deserve a calmer week
const HEAVY_SUBJECTS = ["מתמטיקה", "פיזיקה", "כימיה", "אנגלית", "עברית"];

// Ministry of Education rules
const MAX_EXAMS_PER_DAY = 1;
const MAX_EXAMS_PER_WEEK = 3;
const MAX_EXAMS_PER_HALF_YEAR = 2;

interface ExamProposal {
  id: string;
  subject: string;
  grade: string;
  semester: "first" | "second";
  exam_number: 1 | 2;
  proposed_dates: string[];
  ai_reasoning: string;
  status: "pending_teachers" | "pending_coordinator" | "pending_admin" | "approved" | "rejected";
  teacher_responses: { teacher_id: string; teacher_name: string; approved: boolean; comment: string }[];
  coordinator_response?: { approved: boolean; comment: string };
  created_at: string;
  deadline: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  sender_role: string;
  content: string;
  type: "survey" | "ai_suggestion" | "response" | "approval" | "rejection" | "reminder";
  created_at: string;
  data?: any;
}

const ExamPlannerPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<"new" | "active" | "history">("active");
  const [proposals, setProposals] = useState<ExamProposal[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New proposal form
  const [newSubject, setNewSubject] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newSemester, setNewSemester] = useState<"first" | "second">("second");
  const [newExamNum, setNewExamNum] = useState<1 | 2>(1);
  const [generating, setGenerating] = useState(false);

  const isSubjectCoordinator = (profile as any).roles?.includes("subject_coordinator");
  const isGradeCoordinator = (profile as any).roles?.includes("grade_coordinator");
  const isTeacher = (profile as any).roles?.includes("professional_teacher");

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exam_proposals")
      .select("*")
      .order("created_at", { ascending: false });
    setProposals((data as any) || []);
    setLoading(false);
  };

  // Generate 3 ideal dates using AI logic
  const generateIdealDates = (subject: string, grade: string, examNum: number): { dates: string[]; reasoning: string } => {
    const today = new Date();
    const isHeavy = HEAVY_SUBJECTS.includes(subject);
    const suggestions: string[] = [];
    const reasons: string[] = [];

    // Start from next week
    let cursor = addWeeks(today, 1);

    // For exam 1: aim for mid-semester (weeks 6-8)
    // For exam 2: aim for end of semester (weeks 14-16)
    const targetWeek = examNum === 1 ? addWeeks(today, 6) : addWeeks(today, 14);

    let attempts = 0;
    let weekExamCount = 0;
    let currentWeekStart = "";

    while (suggestions.length < 3 && attempts < 60) {
      const dateStr = format(cursor, "yyyy-MM-dd");
      const weekStr = format(cursor, "yyyy-'W'ww");

      // Skip weekends
      if (isWeekend(cursor)) { cursor = addDays(cursor, 1); attempts++; continue; }
      // Skip holidays
      if (HOLIDAYS_2026.includes(dateStr)) { cursor = addDays(cursor, 1); attempts++; continue; }
      // Skip day after holiday
      if (HOLIDAYS_2026.includes(format(addDays(cursor, -1), "yyyy-MM-dd"))) { cursor = addDays(cursor, 1); attempts++; continue; }

      // Reset weekly counter on new week
      if (weekStr !== currentWeekStart) { currentWeekStart = weekStr; weekExamCount = 0; }
      // Respect max 3 per week rule
      if (weekExamCount >= MAX_EXAMS_PER_WEEK) { cursor = addDays(cursor, 1); attempts++; continue; }

      // For heavy subjects, prefer quieter weeks (Mon/Tue)
      const dayOfWeek = cursor.getDay();
      if (isHeavy && suggestions.length === 0) {
        // Prefer start of week for heavy subjects
        if (dayOfWeek > 2) { cursor = addDays(cursor, 1); attempts++; continue; }
      }

      suggestions.push(dateStr);
      weekExamCount++;

      // Space out suggestions by ~3 weeks for exam 2, ~1 week for exam 1
      const spacing = examNum === 2 ? 21 : 7;
      cursor = addDays(cursor, spacing);
      attempts++;
    }

    // Build reasoning
    reasons.push(`מבחן ${examNum === 1 ? "ראשון" : "שני"} ב${subject} לשכבה ${grade}'`);
    if (isHeavy) reasons.push("מקצוע מרכזי — הוצעה שבוע יחסית רגוע");
    reasons.push("הופרד ממבחנים אחרים לפי תקנת משרד החינוך (מקסימום 3 בשבוע)");
    reasons.push("הוסרו ימי חג, שבתות וימי שישי");
    if (examNum === 2) reasons.push("פיזור מרבי בין המבחן הראשון לשני");

    return { dates: suggestions, reasoning: reasons.join(" | ") };
  };

  const createProposal = async () => {
    if (!newSubject || !newGrade) return;
    setGenerating(true);

    try {
      const { dates, reasoning } = generateIdealDates(newSubject, newGrade, newExamNum);
      const deadline = format(addDays(new Date(), 7), "yyyy-MM-dd");

      const proposal = {
        subject: newSubject,
        grade: newGrade,
        semester: newSemester,
        exam_number: newExamNum,
        proposed_dates: dates,
        ai_reasoning: reasoning,
        status: "pending_teachers",
        teacher_responses: [],
        created_by: profile.id,
        deadline,
        school_id: (profile as any).school_id,
      };

      const { data, error } = await supabase
        .from("exam_proposals")
        .insert(proposal)
        .select()
        .single();

      if (error) throw error;

      // Add initial AI message to chat
      await supabase.from("exam_proposal_messages").insert({
        proposal_id: data.id,
        sender_name: "מערכת App2Class",
        sender_role: "system",
        content: `📋 **סקר תכנון מבחן — ${newSubject} שכבה ${newGrade}'**\n\nשלום למורי ${newSubject} בשכבה ${newGrade}'!\n\nאני מנסח עבורכם 3 תאריכים מומלצים למבחן ${newExamNum === 1 ? "הראשון" : "השני"} במחצית:\n\n${dates.map((d, i) => `**אפשרות ${i + 1}:** ${format(new Date(d), "EEEE, d בMMMM yyyy", { locale: he })}`).join("\n")}\n\n📊 **הנימוק:** ${reasoning}\n\n⏰ **נא להגיב עד:** ${format(new Date(deadline), "d בMMMM", { locale: he })}\n\nיש לכם הערות או תאריכים עדיפים? כתבו כאן!`,
        type: "ai_suggestion",
        data: { dates, reasoning },
      });

      toast({ title: `הצעת מבחן נוצרה! 📅 נשלח לכל מורי ${newSubject} בשכבה ${newGrade}'` });
      setNewSubject(""); setNewGrade("");
      loadProposals();
      setTab("active");
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const respondToProposal = async (proposalId: string, approved: boolean, comment: string, dateChoice?: string) => {
    try {
      const proposal = proposals.find(p => p.id === proposalId);
      if (!proposal) return;

      if (isTeacher) {
        const newResponse = {
          teacher_id: profile.id,
          teacher_name: (profile as any).full_name || "מורה",
          approved,
          comment,
          preferred_date: dateChoice,
        };

        await supabase.from("exam_proposals").update({
          teacher_responses: [...(proposal.teacher_responses || []), newResponse],
        }).eq("id", proposalId);

        // Add message to chat
        await supabase.from("exam_proposal_messages").insert({
          proposal_id: proposalId,
          sender_name: (profile as any).full_name || "מורה",
          sender_role: "teacher",
          content: `${approved ? "✅" : "❌"} ${approved ? "מאשר/ת" : "יש לי הערה"}: ${comment}${dateChoice ? ` | תאריך מועדף: ${format(new Date(dateChoice), "d בMMMM", { locale: he })}` : ""}`,
          type: approved ? "approval" : "response",
        });

        toast({ title: "תגובתך נרשמה ✅" });
      } else if (isGradeCoordinator) {
        // Coordinator approves → move to admin
        await supabase.from("exam_proposals").update({
          status: approved ? "pending_admin" : "rejected",
          coordinator_response: { approved, comment },
        }).eq("id", proposalId);

        await supabase.from("exam_proposal_messages").insert({
          proposal_id: proposalId,
          sender_name: (profile as any).full_name || "רכזת שכבה",
          sender_role: "grade_coordinator",
          content: `${approved ? "✅ **רכזת השכבה אישרה**" : "❌ **רכזת השכבה דחתה**"}: ${comment}`,
          type: approved ? "approval" : "rejection",
        });

        toast({ title: approved ? "הועבר לאישור הנהלה 📋" : "ההצעה נדחתה" });
      }

      loadProposals();
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending_teachers": return { label: "ממתין לתגובת מורים", color: "bg-warning/10 text-warning border-warning/30", icon: "⏳" };
      case "pending_coordinator": return { label: "ממתין לרכזת שכבה", color: "bg-info/10 text-info border-info/30", icon: "👩‍💼" };
      case "pending_admin": return { label: "ממתין לאישור הנהלה", color: "bg-primary/10 text-primary border-primary/30", icon: "🏫" };
      case "approved": return { label: "מאושר ✅", color: "bg-success/10 text-success border-success/30", icon: "✅" };
      case "rejected": return { label: "נדחה", color: "bg-destructive/10 text-destructive border-destructive/30", icon: "❌" };
      default: return { label: status, color: "bg-muted text-muted-foreground", icon: "?" };
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Calendar className="h-7 w-7 text-primary" />
            מתכנן מבחנים חכם
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            תכנון מבחנים לפי תקנות משרד החינוך עם AI
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="gap-1">📋 מקס׳ 1 מבחן ביום</Badge>
          <Badge variant="outline" className="gap-1">📅 מקס׳ 3 בשבוע</Badge>
          <Badge variant="outline" className="gap-1">📚 מקס׳ 2 במחצית</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: "active", label: "הצעות פעילות" },
          { id: "new", label: isSubjectCoordinator ? "הצעה חדשה" : null },
          { id: "history", label: "היסטוריה" },
        ].filter(t => t.label).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-heading border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* New Proposal Form (subject coordinators only) */}
      {tab === "new" && isSubjectCoordinator && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> יצירת הצעת מבחן חדשה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">מקצוע</Label>
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="בחר מקצוע" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">שכבה</Label>
                <Select value={newGrade} onValueChange={setNewGrade}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="בחר שכבה" /></SelectTrigger>
                  <SelectContent>
                    {GRADES.map(g => <SelectItem key={g} value={g} className="text-xs">שכבה {g}'</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">מחצית</Label>
                <Select value={newSemester} onValueChange={(v: any) => setNewSemester(v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first" className="text-xs">מחצית א׳</SelectItem>
                    <SelectItem value="second" className="text-xs">מחצית ב׳</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">מספר מבחן</Label>
                <Select value={String(newExamNum)} onValueChange={(v) => setNewExamNum(+v as 1 | 2)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">מבחן ראשון</SelectItem>
                    <SelectItem value="2" className="text-xs">מבחן שני</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="bg-info/5 border-info/20">
              <CardContent className="p-3 text-xs text-info">
                <Sparkles className="h-4 w-4 inline ml-1" />
                ה-AI יחשב 3 תאריכים אידיאליים תוך כדי בדיקת: עומס שבועי, חגים, פיזור מרבי בין מבחנים, ועדיפות למקצועות מרכזיים.
                לאחר מכן ישלח סקר אוטומטי לכל מורי המקצוע בשכבה.
              </CardContent>
            </Card>

            <Button
              className="w-full gap-2 font-heading"
              onClick={createProposal}
              disabled={generating || !newSubject || !newGrade}
            >
              {generating ? (
                <><Sparkles className="h-4 w-4 animate-spin" /> מחשב תאריכים אידיאליים...</>
              ) : (
                <><Calendar className="h-4 w-4" /> צור הצעה ושלח לצוות</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Proposals */}
      {tab === "active" && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">טוען...</div>
          ) : proposals.filter(p => p.status !== "approved" && p.status !== "rejected").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">אין הצעות פעילות כרגע</p>
              </CardContent>
            </Card>
          ) : (
            proposals
              .filter(p => p.status !== "approved" && p.status !== "rejected")
              .map(proposal => {
                const statusCfg = getStatusConfig(proposal.status);
                const isExpanded = expandedProposal === proposal.id;
                const myResponse = proposal.teacher_responses?.find(r => r.teacher_id === profile.id);
                const daysLeft = Math.ceil((new Date(proposal.deadline).getTime() - Date.now()) / 86400000);
                const isOverdue = daysLeft < 0;

                return (
                  <Card key={proposal.id} className={`transition-all ${isOverdue ? "border-destructive/30" : ""}`}>
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">📅</div>
                          <div>
                            <h3 className="font-heading font-bold">
                              {proposal.subject} — שכבה {proposal.grade}׳
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              מבחן {proposal.exam_number === 1 ? "ראשון" : "שני"} • מחצית {proposal.semester === "first" ? "א׳" : "ב׳"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs border ${statusCfg.color}`}>
                            {statusCfg.icon} {statusCfg.label}
                          </Badge>
                          {isOverdue ? (
                            <Badge variant="destructive" className="text-xs">⚠️ פג תוקף</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">⏰ {daysLeft} ימים</Badge>
                          )}
                        </div>
                      </div>

                      {/* Proposed dates */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {(proposal.proposed_dates || []).map((date, i) => (
                          <div key={i} className="text-center p-2 rounded-lg bg-muted/50 border">
                            <p className="text-[10px] text-muted-foreground font-heading">אפשרות {i + 1}</p>
                            <p className="text-xs font-bold">
                              {format(new Date(date), "d MMM", { locale: he })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(date), "EEEE", { locale: he })}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* AI Reasoning */}
                      <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 mb-3">
                        <p className="text-[10px] text-accent font-heading flex items-center gap-1 mb-1">
                          <Sparkles className="h-3 w-3" /> נימוק AI
                        </p>
                        <p className="text-xs text-muted-foreground">{proposal.ai_reasoning}</p>
                      </div>

                      {/* Teacher responses summary */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {proposal.teacher_responses?.length || 0} מורים הגיבו
                          <span className="text-success">
                            ✅ {proposal.teacher_responses?.filter(r => r.approved).length || 0} מאשרים
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedProposal(isExpanded ? null : proposal.id)}
                          className="text-xs text-primary font-heading flex items-center gap-1"
                        >
                          {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> סגור</> : <><ChevronDown className="h-3.5 w-3.5" /> פרטים ותגובה</>}
                        </button>
                      </div>

                      {/* Expanded section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 border-t pt-3"
                          >
                            {/* Chat messages */}
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {(chatMessages[proposal.id] || []).map(msg => (
                                <div key={msg.id} className={`flex gap-2 ${msg.sender_role === "system" ? "justify-start" : "justify-end"}`}>
                                  <div className={`max-w-[80%] rounded-xl p-3 text-xs ${
                                    msg.sender_role === "system" ? "bg-accent/10 text-accent" :
                                    msg.sender_role === "grade_coordinator" ? "bg-primary/10 text-primary" :
                                    "bg-muted text-foreground"
                                  }`}>
                                    <p className="font-heading font-bold text-[10px] mb-1">{msg.sender_name}</p>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Teacher response */}
                            {isTeacher && !myResponse && proposal.status === "pending_teachers" && (
                              <TeacherResponseForm
                                proposal={proposal}
                                onSubmit={(approved, comment, dateChoice) =>
                                  respondToProposal(proposal.id, approved, comment, dateChoice)
                                }
                              />
                            )}

                            {myResponse && (
                              <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-xs">
                                <p className="font-heading font-bold text-success">✅ הגבת כבר</p>
                                <p className="text-muted-foreground">{myResponse.comment}</p>
                              </div>
                            )}

                            {/* Grade coordinator response */}
                            {isGradeCoordinator && proposal.status === "pending_coordinator" && (
                              <CoordinatorResponseForm
                                proposal={proposal}
                                onSubmit={(approved, comment) =>
                                  respondToProposal(proposal.id, approved, comment)
                                }
                              />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="space-y-3">
          {proposals
            .filter(p => p.status === "approved" || p.status === "rejected")
            .map(proposal => {
              const statusCfg = getStatusConfig(proposal.status);
              return (
                <Card key={proposal.id} className="opacity-75">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-heading font-bold text-sm">{proposal.subject} — שכבה {proposal.grade}׳</p>
                      <p className="text-xs text-muted-foreground">
                        מבחן {proposal.exam_number} • {format(new Date(proposal.created_at), "d בMMMM", { locale: he })}
                      </p>
                    </div>
                    <Badge className={`text-xs border ${statusCfg.color}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </motion.div>
  );
};

// Teacher response form
const TeacherResponseForm = ({ proposal, onSubmit }: {
  proposal: ExamProposal;
  onSubmit: (approved: boolean, comment: string, dateChoice?: string) => void;
}) => {
  const [comment, setComment] = useState("");
  const [selectedDate, setSelectedDate] = useState(proposal.proposed_dates?.[0] || "");
  const [approving, setApproving] = useState(false);

  return (
    <div className="space-y-3 bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-heading font-bold">התגובה שלך</p>
      <div className="grid grid-cols-3 gap-2">
        {(proposal.proposed_dates || []).map((date, i) => (
          <button
            key={i}
            onClick={() => setSelectedDate(date)}
            className={`p-2 rounded-lg border text-xs text-center transition-all ${selectedDate === date ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
          >
            <p className="font-bold">{format(new Date(date), "d MMM", { locale: he })}</p>
            <p className="text-[10px] text-muted-foreground">{format(new Date(date), "EEEE", { locale: he })}</p>
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="הערות נוספות (אופציונלי)..."
        rows={2}
        className="text-xs"
      />
      <div className="flex gap-2">
        <Button
          className="flex-1 gap-1 font-heading text-xs bg-success hover:bg-success/90"
          onClick={() => onSubmit(true, comment || "מאשר/ת", selectedDate)}
        >
          <ThumbsUp className="h-3.5 w-3.5" /> מאשר/ת
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-1 font-heading text-xs border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => onSubmit(false, comment || "יש לי הערה")}
        >
          <ThumbsDown className="h-3.5 w-3.5" /> יש לי הערה
        </Button>
      </div>
    </div>
  );
};

// Coordinator response form
const CoordinatorResponseForm = ({ proposal, onSubmit }: {
  proposal: ExamProposal;
  onSubmit: (approved: boolean, comment: string) => void;
}) => {
  const [comment, setComment] = useState("");

  return (
    <div className="space-y-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
      <p className="text-xs font-heading font-bold text-primary">👩‍💼 אישור רכזת שכבה</p>
      <p className="text-xs text-muted-foreground">
        {proposal.teacher_responses?.filter(r => r.approved).length || 0} מורים אישרו את ההצעה.
        האם לאשר ולהעביר לאישור הנהלה?
      </p>
      <Textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="הערות לצוות (אופציונלי)..."
        rows={2}
        className="text-xs"
      />
      <div className="flex gap-2">
        <Button
          className="flex-1 gap-1 font-heading text-xs"
          onClick={() => onSubmit(true, comment || "מאושר על ידי רכזת השכבה")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> אשר והעבר להנהלה
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-1 font-heading text-xs border-destructive text-destructive"
          onClick={() => onSubmit(false, comment || "נדחה על ידי רכזת השכבה")}
        >
          דחה
        </Button>
      </div>
    </div>
  );
};

export default ExamPlannerPage;
