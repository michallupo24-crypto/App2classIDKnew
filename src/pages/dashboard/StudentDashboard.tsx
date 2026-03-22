import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Brain, BookOpen, Calendar, Bell, Star, Flame, Trophy,
  Clock, AlertTriangle, CheckCircle2, MessageSquare, Zap,
  TrendingUp, TrendingDown, Shield, Target
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { he } from "date-fns/locale";


const StudentDashboard = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState("");
  const [focusLevel, setFocusLevel] = useState(75);
  const [rights, setRights] = useState({ examMaterial: true, examCount: 0, gradesReturned: true });

  useEffect(() => {
    loadDashboard();
  }, [profile.id]);

  const loadDashboard = async () => {
    // Load assignments
    const { data: assignData } = await supabase
      .from("assignments")
      .select("*, classes(grade, class_number)")
      .eq("published", true)
      .order("due_date", { ascending: true })
      .limit(5);
    setAssignments(assignData || []);

    // Load grades
    const { data: subData } = await supabase
      .from("submissions")
      .select("*, assignments(title, subject, weight_percent)")
      .eq("student_id", profile.id)
      .not("grade", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(8);
    setGrades(subData || []);

    // Load streak from gamification
    const { data: gamData } = await supabase
      .from("gamification_stats")
      .select("streak_days, badges")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (gamData) {
      setStreak(gamData.streak_days || 0);
      setBadges(gamData.badges || []);
    }

    // Generate AI insight
    generateAiInsight(assignData || [], subData || []);
  };

  const generateAiInsight = (assignments: any[], grades: any[]) => {
    const overdue = assignments.filter(a => a.due_date && new Date(a.due_date) < new Date());
    const urgent = assignments.filter(a => {
      if (!a.due_date) return false;
      const diff = differenceInDays(new Date(a.due_date), new Date());
      return diff <= 3 && diff >= 0;
    });
    const avgGrade = grades.length > 0
      ? Math.round(grades.reduce((s, g) => s + (g.grade || 0), 0) / grades.length)
      : null;

    if (overdue.length > 0) {
      setAiInsight(`⚠️ יש לך ${overdue.length} משימה/ות שעבר מועד ההגשה שלהן. כדאי לטפל בזה מיד ולדבר עם המורה.`);
    } else if (urgent.length > 0) {
      setAiInsight(`📅 יש לך ${urgent.length} משימה/ות לשלושת הימים הקרובים. ${urgent[0]?.title} היא הדחופה ביותר.`);
    } else if (avgGrade && avgGrade >= 90) {
      setAiInsight(`🌟 ממוצע הציונים שלך הוא ${avgGrade} — מעולה! שמור על הקצב הזה.`);
    } else if (avgGrade && avgGrade < 70) {
      setAiInsight(`💡 הממוצע שלך הוא ${avgGrade}. שקול לפנות למורה לתגבור או להשתמש ב-AI Tutor לתרגול.`);
    } else {
      setAiInsight(`✨ הכל על המסלול! היום אין משימות דחופות. זמן טוב לחזור על חומר ולהתכונן למבחנים.`);
    }
  };

  const getUrgencyColor = (dueDate: string) => {
    if (!dueDate) return "bg-muted text-muted-foreground";
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return "bg-destructive/10 text-destructive border-destructive/30";
    if (days === 0) return "bg-destructive/10 text-destructive border-destructive/30";
    if (days <= 3) return "bg-warning/10 text-warning border-warning/30";
    return "bg-success/10 text-success border-success/30";
  };

  const getCountdown = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    if (due < now) return "פג תוקף";
    const days = differenceInDays(due, now);
    if (days > 0) return `${days} ימים`;
    const hours = differenceInHours(due, now);
    if (hours > 0) return `${hours} שעות`;
    return `${differenceInMinutes(due, now)} דקות`;
  };

  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="space-y-6" dir="rtl"
    >
      {/* Header with avatar and streak */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted border-2 border-primary/20">
            🧑
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">שלום, {profile.full_name?.split(" ")[0]}! 👋</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d בMMMM", { locale: he })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="flex items-center gap-1 text-warning font-bold">
              <Flame className="h-5 w-5" />
              <span className="text-xl">{streak}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">סטרייק ימים</p>
          </div>
        </div>
      </motion.div>

      {/* AI Insight Banner */}
      <motion.div variants={item}>
        <Card className="border-accent/30 bg-gradient-to-l from-accent/10 to-transparent overflow-hidden">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-heading font-bold text-accent mb-1">תובנת AI אישית</p>
              <p className="text-sm font-body">{aiInsight || "טוען תובנה..."}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={item} className="grid grid-cols-4 gap-3">
        {[
          { label: "משימות פתוחות", value: assignments.filter(a => !a.due_date || new Date(a.due_date) >= new Date()).length, icon: BookOpen, color: "text-primary" },
          { label: "ממוצע ציונים", value: grades.length > 0 ? Math.round(grades.reduce((s, g) => s + (g.grade || 0), 0) / grades.length) : "—", icon: Trophy, color: "text-warning" },
          { label: "תגים שנצברו", value: badges.length, icon: Star, color: "text-accent" },
          { label: "מבחנים קרובים", value: upcomingExams.length, icon: Calendar, color: "text-destructive" },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-3 text-center">
              <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
              <p className="text-xl font-bold font-heading">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Assignments */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> המשימות שלי
          </h2>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/dashboard/tasks")}>הכל →</Button>
        </div>
        {assignments.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">אין משימות פתוחות 🎉</CardContent></Card>
        ) : (
          assignments.slice(0, 4).map((a) => (
            <Card key={a.id} className={`border ${getUrgencyColor(a.due_date)}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-heading font-bold text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.subject}</p>
                </div>
                <div className="text-left">
                  {a.due_date && (
                    <Badge variant="outline" className={`text-[10px] ${getUrgencyColor(a.due_date)}`}>
                      <Clock className="h-2.5 w-2.5 ml-1" />{getCountdown(a.due_date)}
                    </Badge>
                  )}
                  {a.weight_percent && (
                    <p className="text-[10px] text-muted-foreground mt-1">{a.weight_percent}% מהציון</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </motion.div>

      {/* Grades + Rights Guardian */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Grades */}
        <motion.div variants={item} className="space-y-3">
          <h2 className="font-heading font-bold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" /> ציונים אחרונים
          </h2>
          {grades.slice(0, 4).map((g, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-heading font-bold">{g.assignments?.title}</p>
                  <p className="text-[10px] text-muted-foreground">{g.assignments?.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold font-heading ${g.grade >= 90 ? "text-success" : g.grade >= 70 ? "text-warning" : "text-destructive"}`}>
                    {g.grade}
                  </span>
                  {g.grade >= 90 ? <TrendingUp className="h-4 w-4 text-success" /> : g.grade < 70 ? <TrendingDown className="h-4 w-4 text-destructive" /> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Rights Guardian */}
        <motion.div variants={item} className="space-y-3">
          <h2 className="font-heading font-bold flex items-center gap-2">
            <Shield className="h-4 w-4 text-info" /> מגן הזכויות שלי
          </h2>
          <Card>
            <CardContent className="p-4 space-y-3">
              {[
                { label: "חומר למבחן הועלה בזמן", ok: rights.examMaterial, detail: "שבוע לפחות לפני" },
                { label: "לא יותר מ-3 מבחנים בשבוע", ok: rights.examCount <= 3, detail: `${rights.examCount} מבחנים השבוע` },
                { label: "ציונים הוחזרו בזמן", ok: rights.gradesReturned, detail: "תוך 14 יום" },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-xs font-heading">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground">{r.detail}</p>
                  </div>
                  {r.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs font-heading gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> הגש פנייה
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <h2 className="font-heading font-bold flex items-center gap-2">
            <Star className="h-4 w-4 text-warning" /> התגים שלי
          </h2>
          <div className="flex flex-wrap gap-2">
            {badges.map((b: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1 bg-warning/10 text-warning border-warning/30">
                {b.icon} {b.name}
              </Badge>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StudentDashboard;
