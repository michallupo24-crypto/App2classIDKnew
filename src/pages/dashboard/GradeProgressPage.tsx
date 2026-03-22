import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, BookOpen,
  Users, Brain, CheckCircle2, Clock, Activity,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClassProgress {
  classId: string;
  className: string;
  studentCount: number;
  lessonsCount: number;
  avgAttendance: number;
  assignmentsCount: number;
  subjects: string[];
}

interface SubjectProgress {
  subject: string;
  lessonsCount: number;
  classesCount: number;
}

const GradeProgressPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const [classes, setClasses] = useState<ClassProgress[]>([]);
  const [subjects, setSubjects] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: roleData } = await supabase
        .from("user_roles").select("grade")
        .eq("user_id", profile.id).eq("role", "grade_coordinator").maybeSingle();

      if (!roleData?.grade || !profile.schoolId) { setLoading(false); return; }

      const { data: classesData } = await supabase
        .from("classes").select("id, grade, class_number")
        .eq("school_id", profile.schoolId).eq("grade", roleData.grade);

      if (!classesData || classesData.length === 0) { setLoading(false); return; }

      const classIds = classesData.map((c: any) => c.id);

      const [studentsRes, lessonsRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("id, class_id").in("class_id", classIds),
        supabase.from("lessons").select("id, class_id, subject").in("class_id", classIds),
        supabase.from("assignments").select("id, class_id, subject").in("class_id", classIds),
      ]);

      const students = studentsRes.data || [];
      const lessons = lessonsRes.data || [];
      const assignments = assignmentsRes.data || [];

      const classProgress: ClassProgress[] = classesData.map((c: any) => {
        const classStudents = students.filter((s: any) => s.class_id === c.id);
        const classLessons = lessons.filter((l: any) => l.class_id === c.id);
        const classAssignments = assignments.filter((a: any) => a.class_id === c.id);
        const uniqueSubjects = [...new Set(classLessons.map((l: any) => l.subject))];

        return {
          classId: c.id,
          className: `${c.grade}'${c.class_number}`,
          studentCount: classStudents.length,
          lessonsCount: classLessons.length,
          avgAttendance: 0,
          assignmentsCount: classAssignments.length,
          subjects: uniqueSubjects,
        };
      });

      // Subject-level progress
      const subjectMap = new Map<string, { lessons: number; classes: Set<string> }>();
      lessons.forEach((l: any) => {
        if (!subjectMap.has(l.subject)) subjectMap.set(l.subject, { lessons: 0, classes: new Set() });
        const entry = subjectMap.get(l.subject)!;
        entry.lessons++;
        entry.classes.add(l.class_id);
      });
      const subjectProgress: SubjectProgress[] = Array.from(subjectMap.entries()).map(([subject, data]) => ({
        subject,
        lessonsCount: data.lessons,
        classesCount: data.classes.size,
      }));

      setClasses(classProgress);
      setSubjects(subjectProgress.sort((a, b) => b.lessonsCount - a.lessonsCount));
      setLoading(false);
    };
    load();
  }, [profile.id, profile.schoolId]);

  const requestAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const { data } = await supabase.functions.invoke("grade-coordinator-ai", {
        body: {
          action: "progress_analysis",
          schoolId: profile.schoolId,
          userId: profile.id,
          context: { classes, subjects },
        },
      });
      setAiAnalysis(data?.analysis || "לא ניתן לייצר ניתוח כרגע.");
    } catch {
      setAiAnalysis("שגיאה בייצור ניתוח AI.");
    }
    setLoadingAi(false);
  };

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-success" />
            דופק שכבתי
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">מעקב התקדמות חוצה-מקצועות לכלל כיתות השכבה</p>
        </div>
        <button
          onClick={requestAiAnalysis}
          disabled={loadingAi}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-heading text-sm font-medium disabled:opacity-50"
        >
          <Brain className="h-4 w-4" />
          {loadingAi ? "מנתח..." : "ניתוח AI"}
        </button>
      </motion.div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <motion.div variants={item}>
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-heading font-bold text-sm mb-2">ניתוח AI</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען נתוני שכבה...</div>
      ) : (
        <>
          {/* Classes Overview */}
          <motion.div variants={item}>
            <h2 className="font-heading font-bold text-lg mb-3">כיתות השכבה</h2>
            {classes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>אין כיתות בשכבה זו</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.map((c) => (
                  <Card key={c.classId}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-heading font-bold text-lg">{c.className}</h3>
                        <Badge variant="outline">{c.studentCount} תלמידים</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">שיעורים שנוהלו</span>
                          <span className="font-heading font-bold">{c.lessonsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">משימות</span>
                          <span className="font-heading font-bold">{c.assignmentsCount}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.subjects.slice(0, 4).map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                          {c.subjects.length > 4 && (
                            <Badge variant="outline" className="text-[10px]">+{c.subjects.length - 4}</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>

          {/* Subject Progress */}
          <motion.div variants={item}>
            <h2 className="font-heading font-bold text-lg mb-3">התקדמות לפי מקצוע</h2>
            {subjects.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>אין שיעורים מתועדים עדיין</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-4">
                  <div className="space-y-4">
                    {subjects.map((s) => (
                      <div key={s.subject} className="flex items-center gap-4">
                        <div className="w-28 font-heading font-medium text-sm truncate">{s.subject}</div>
                        <div className="flex-1">
                          <Progress value={Math.min((s.lessonsCount / 30) * 100, 100)} className="h-2" />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                          <span>{s.lessonsCount} שיעורים</span>
                          <Badge variant="outline" className="text-[10px]">{s.classesCount} כיתות</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default GradeProgressPage;
