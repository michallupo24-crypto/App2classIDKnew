import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Bell, Calendar, MessageSquare, Shield, Users, BarChart2, Clock
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const ParentDashboardPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState("");
  const [classAvgGrades, setClassAvgGrades] = useState<any[]>([]);
  const [gradesTrend, setGradesTrend] = useState<any[]>([]);

  useEffect(() => {
    loadChild();
  }, [profile.id]);

  const loadChild = async () => {
    const { data: ps } = await supabase.from("parent_student")
      .select("student_id, profiles!student_id(id, full_name, class_id, classes(grade, class_number))")
      .eq("parent_id", profile.id).limit(1);
    if (ps?.length) {
      const c = (ps[0] as any).profiles;
      setChild(c);
      loadChildData(c.id, c.class_id);
    }
  };

  const loadChildData = async (studentId: string, classId: string) => {
    // Grades
    const { data: subs } = await supabase.from("submissions")
      .select("*, assignments(title, subject, weight_percent)")
      .eq("student_id", studentId).not("grade", "is", null)
      .order("submitted_at", { ascending: false }).limit(10);
    setGrades(subs || []);

    // Class avg for comparison
    const { data: classGrades } = await supabase.from("submissions")
      .select("grade, assignments(subject, class_id)")
      .eq("assignments.class_id", classId).not("grade", "is", null);

    // Group by subject
    const subjectAvgs: Record<string, number[]> = {};
    classGrades?.forEach((g: any) => {
      const sub = g.assignments?.subject;
      if (sub) {
        if (!subjectAvgs[sub]) subjectAvgs[sub] = [];
        subjectAvgs[sub].push(g.grade);
      }
    });
    const childSubjectAvgs: Record<string, number[]> = {};
    subs?.forEach((g: any) => {
      const sub = g.assignments?.subject;
      if (sub) {
        if (!childSubjectAvgs[sub]) childSubjectAvgs[sub] = [];
        childSubjectAvgs[sub].push(g.grade);
      }
    });
    const compData = Object.keys(subjectAvgs).slice(0, 6).map(sub => ({
      name: sub.slice(0, 4),
      ילד: childSubjectAvgs[sub] ? Math.round(childSubjectAvgs[sub].reduce((a, b) => a + b, 0) / childSubjectAvgs[sub].length) : 0,
      ממוצע: Math.round(subjectAvgs[sub].reduce((a, b) => a + b, 0) / subjectAvgs[sub].length),
    }));
    setClassAvgGrades(compData);

    // Trend
    const trend = subs?.slice(0, 8).reverse().map((g: any, i: number) => ({
      name: format(new Date(g.submitted_at || Date.now()), "d/M"),
      ציון: g.grade,
    })) || [];
    setGradesTrend(trend);

    // Absences
    const { data: abs } = await supabase.from("attendance")
      .select("*").eq("student_id", studentId).eq("status", "absent")
      .order("date", { ascending: false }).limit(20);
    setAbsences(abs || []);

    // Assignments
    const { data: asgn } = await supabase.from("assignments")
      .select("*").eq("class_id", classId).eq("published", true)
      .order("due_date", { ascending: true }).limit(5);
    setAssignments(asgn || []);

    // AI insight
    const avgGrade = subs?.length ? Math.round(subs.reduce((s, g) => s + (g.grade || 0), 0) / subs.length) : null;
    const unexcusedAbs = abs?.filter((a: any) => !a.is_justified).length || 0;
    if (unexcusedAbs > 5) setAiInsight(`⚠️ ${child?.full_name?.split(" ")[0]} יש ${unexcusedAbs} חיסורים לא מוצדקים. מומלץ לטפל לפני שזה משפיע על הציון.`);
    else if (avgGrade && avgGrade >= 88) setAiInsight(`🌟 ${child?.full_name?.split(" ")[0]} במגמת הצלחה עם ממוצע ${avgGrade}! המשך כך.`);
    else if (avgGrade && avgGrade < 65) setAiInsight(`💡 הממוצע של ${child?.full_name?.split(" ")[0]} הוא ${avgGrade}. כדאי לבדוק אם נדרש תגבור.`);
    else setAiInsight(`📊 ${child?.full_name?.split(" ")[0]} מתפקד בצורה סבירה. ממוצע: ${avgGrade || "—"}.`);
  };

  const absencePercent = Math.round((absences.length / 180) * 100);
  const avgGrade = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + (g.grade || 0), 0) / grades.length) : 0;

  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  if (!child) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-muted-foreground text-sm">לא נמצא ילד מקושר לחשבון שלך</p>
    </div>
  );

  return (
    <motion.div initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="space-y-6" dir="rtl">

      {/* Child info */}
      <motion.div variants={item} className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted border-2 border-primary/20">
          🧒
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold">{child.full_name}</h1>
          <p className="text-sm text-muted-foreground">כיתה {child.classes?.grade}׳{child.classes?.class_number}</p>
        </div>
      </motion.div>

      {/* AI Insight */}
      <motion.div variants={item}>
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Brain className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-heading font-bold text-accent mb-1">תובנת AI</p>
              <p className="text-sm">{aiInsight}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold font-heading ${avgGrade >= 80 ? "text-success" : avgGrade >= 60 ? "text-warning" : "text-destructive"}`}>{avgGrade || "—"}</p>
            <p className="text-[10px] text-muted-foreground">ממוצע ציונים</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold font-heading ${absencePercent < 10 ? "text-success" : absencePercent < 15 ? "text-warning" : "text-destructive"}`}>{absencePercent}%</p>
            <p className="text-[10px] text-muted-foreground">חיסורים</p>
            {absencePercent >= 12 && <p className="text-[10px] text-warning">⚠️ מתקרב ל-15%</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-heading text-primary">{assignments.filter(a => a.due_date && new Date(a.due_date) >= new Date()).length}</p>
            <p className="text-[10px] text-muted-foreground">משימות קרובות</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Grade comparison chart */}
      {classAvgGrades.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-info" /> השוואה לממוצע הכיתה
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={classAvgGrades}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="ילד" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ממוצע" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded inline-block" /> {child.full_name?.split(" ")[0]}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-400 rounded inline-block" /> ממוצע כיתה</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Grade trend */}
      {gradesTrend.length > 2 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" /> מגמת ציונים
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={gradesTrend}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="ציון" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upcoming assignments */}
      <motion.div variants={item} className="space-y-3">
        <h2 className="font-heading font-bold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-warning" /> משימות קרובות
        </h2>
        {assignments.slice(0, 3).map(a => (
          <Card key={a.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-heading font-bold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.subject}</p>
              </div>
              {a.due_date && (
                <Badge variant="outline" className="text-xs">
                  {differenceInDays(new Date(a.due_date), new Date())} ימים
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Quick actions */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="gap-2 font-heading text-xs h-auto py-3 flex-col" onClick={() => navigate("/dashboard/chat")}>
          <MessageSquare className="h-5 w-5 text-primary" />
          שלח הודעה למחנך/ת
        </Button>
        <Button variant="outline" className="gap-2 font-heading text-xs h-auto py-3 flex-col" onClick={() => navigate("/dashboard/attendance")}>
          <CheckCircle2 className="h-5 w-5 text-success" />
          הצדקת חיסורים
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default ParentDashboardPage;
