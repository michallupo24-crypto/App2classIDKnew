import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, TrendingUp, TrendingDown, Minus, Award, BarChart3,
  BookOpen, Target, Loader2,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

interface GradeEntry {
  id: string;
  title: string;
  subject: string;
  type: string;
  grade: number;
  maxGrade: number;
  weight: number;
  gradedAt: string;
  feedback: string | null;
}

interface SubjectSummary {
  subject: string;
  average: number;
  weightedAvg: number;
  count: number;
  grades: GradeEntry[];
  trend: "up" | "down" | "stable";
}

const TYPE_LABELS: Record<string, string> = {
  homework: "שיעורי בית",
  exam: "מבחן",
  quiz: "בוחן",
  project: "פרויקט",
  exercise: "תרגיל",
};

const StudentGradesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState("all");

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Get all graded submissions for this student with assignment details
      const { data } = await supabase
        .from("submissions")
        .select("id, grade, graded_at, feedback, status, assignment_id, assignments(title, subject, type, weight_percent, max_grade)")
        .eq("student_id", profile.id)
        .eq("status", "graded")
        .not("grade", "is", null)
        .order("graded_at", { ascending: false });

      if (data) {
        setGrades(
          data.map((s: any) => ({
            id: s.id,
            title: s.assignments?.title || "",
            subject: s.assignments?.subject || "",
            type: s.assignments?.type || "homework",
            grade: s.grade,
            maxGrade: s.assignments?.max_grade || 100,
            weight: s.assignments?.weight_percent || 0,
            gradedAt: s.graded_at,
            feedback: s.feedback,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, [profile.id]);

  // Compute subject summaries
  const subjectSummaries = useMemo<SubjectSummary[]>(() => {
    const map = new Map<string, GradeEntry[]>();
    grades.forEach((g) => {
      const list = map.get(g.subject) || [];
      list.push(g);
      map.set(g.subject, list);
    });

    return Array.from(map.entries()).map(([subject, entries]) => {
      const sorted = [...entries].sort(
        (a, b) => new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime()
      );
      const normalizedGrades = sorted.map((e) => (e.grade / e.maxGrade) * 100);
      const avg = normalizedGrades.reduce((s, g) => s + g, 0) / normalizedGrades.length;

      // Weighted average
      const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
      let weightedAvg = avg;
      if (totalWeight > 0) {
        const weightedSum = entries.reduce(
          (s, e) => s + ((e.grade / e.maxGrade) * 100) * e.weight, 0
        );
        weightedAvg = weightedSum / totalWeight;
      }

      // Trend: compare last 2 grades
      let trend: "up" | "down" | "stable" = "stable";
      if (normalizedGrades.length >= 2) {
        const last = normalizedGrades[normalizedGrades.length - 1];
        const prev = normalizedGrades[normalizedGrades.length - 2];
        if (last - prev > 3) trend = "up";
        else if (prev - last > 3) trend = "down";
      }

      return { subject, average: Math.round(avg), weightedAvg: Math.round(weightedAvg), count: entries.length, grades: sorted, trend };
    }).sort((a, b) => b.weightedAvg - a.weightedAvg);
  }, [grades]);

  const overallAvg = useMemo(() => {
    if (subjectSummaries.length === 0) return 0;
    return Math.round(subjectSummaries.reduce((s, ss) => s + ss.weightedAvg, 0) / subjectSummaries.length);
  }, [subjectSummaries]);

  const bestSubject = subjectSummaries[0];
  const worstSubject = subjectSummaries[subjectSummaries.length - 1];

  const filteredGrades = selectedSubject === "all"
    ? grades
    : grades.filter((g) => g.subject === selectedSubject);

  // Chart data for trend
  const chartData = useMemo(() => {
    const source = selectedSubject === "all" ? grades : grades.filter(g => g.subject === selectedSubject);
    return [...source]
      .sort((a, b) => new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime())
      .map((g) => ({
        name: g.title.length > 12 ? g.title.slice(0, 12) + "…" : g.title,
        grade: Math.round((g.grade / g.maxGrade) * 100),
        raw: g.grade,
      }));
  }, [grades, selectedSubject]);

  const gradeColor = (g: number) => {
    if (g >= 90) return "text-success";
    if (g >= 75) return "text-primary";
    if (g >= 60) return "text-warning";
    return "text-destructive";
  };

  const gradeBadgeVariant = (g: number): "default" | "secondary" | "destructive" => {
    if (g >= 75) return "default";
    if (g >= 60) return "secondary";
    return "destructive";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" />
          תיק הציונים שלי
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          ציונים, ממוצעים ומגמות לפי מקצוע
        </p>
      </motion.div>

      {/* Overview cards */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className={`text-2xl font-heading font-bold ${gradeColor(overallAvg)}`}>{overallAvg || "—"}</p>
            <p className="text-[10px] text-muted-foreground">ממוצע כללי</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-heading font-bold">{grades.length}</p>
            <p className="text-[10px] text-muted-foreground">ציונים</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-success" />
            <p className="text-sm font-heading font-bold truncate">{bestSubject?.subject || "—"}</p>
            <p className="text-[10px] text-muted-foreground">
              {bestSubject ? `ממוצע ${bestSubject.weightedAvg}` : "חזק ביותר"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-warning" />
            <p className="text-sm font-heading font-bold truncate">{worstSubject?.subject || "—"}</p>
            <p className="text-[10px] text-muted-foreground">
              {worstSubject ? `ממוצע ${worstSubject.weightedAvg}` : "לשיפור"}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Subject averages */}
      {subjectSummaries.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                ממוצעים לפי מקצוע
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {subjectSummaries.map((ss) => (
                <div
                  key={ss.subject}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedSubject(ss.subject === selectedSubject ? "all" : ss.subject)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {ss.trend === "up" && <TrendingUp className="h-4 w-4 text-success" />}
                      {ss.trend === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
                      {ss.trend === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <span className="font-heading font-medium text-sm">{ss.subject}</span>
                    <span className="text-[10px] text-muted-foreground">({ss.count} ציונים)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className={`font-heading font-bold text-lg ${gradeColor(ss.weightedAvg)}`}>
                        {ss.weightedAvg}
                      </span>
                      {ss.weightedAvg !== ss.average && (
                        <span className="text-[10px] text-muted-foreground mr-1">(ממוצע {ss.average})</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Chart */}
      {chartData.length >= 2 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                מגמת ציונים
                {selectedSubject !== "all" && (
                  <Badge variant="outline" className="text-[10px]">{selectedSubject}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value: any) => [`${value}`, "ציון"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="grade"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filter */}
      <motion.div variants={item} className="flex items-center gap-3">
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="כל המקצועות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המקצועות</SelectItem>
            {subjectSummaries.map((ss) => (
              <SelectItem key={ss.subject} value={ss.subject}>{ss.subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredGrades.length} ציונים</span>
      </motion.div>

      {/* Grades list */}
      <div className="space-y-2">
        {filteredGrades.length === 0 ? (
          <motion.div variants={item}>
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-body">אין ציונים עדיין</p>
                <p className="text-sm text-muted-foreground mt-1">הציונים יופיעו כאן ברגע שהמורה יזין אותם</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          filteredGrades.map((g) => {
            const normalized = Math.round((g.grade / g.maxGrade) * 100);
            return (
              <motion.div key={g.id} variants={item}>
                <Card className="hover:shadow-sm transition-all">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {TYPE_LABELS[g.type] || g.type}
                          </Badge>
                          <p className="font-heading font-medium text-sm truncate">{g.title}</p>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{g.subject}</span>
                          {g.weight > 0 && <><span>•</span><span>{g.weight}% מהציון</span></>}
                          {g.gradedAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(g.gradedAt).toLocaleDateString("he-IL")}</span>
                            </>
                          )}
                        </div>
                        {g.feedback && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">💬 {g.feedback}</p>
                        )}
                      </div>
                      <div className="text-left shrink-0">
                        <span className={`font-heading font-bold text-xl ${gradeColor(normalized)}`}>
                          {g.grade}
                        </span>
                        {g.maxGrade !== 100 && (
                          <span className="text-xs text-muted-foreground">/{g.maxGrade}</span>
                        )}
                        <div className="text-[10px] text-muted-foreground text-center">
                          ממוצע: {subjectSummaries.find(s => s.subject === g.subject)?.weightedAvg || "—"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default StudentGradesPage;
