import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Calendar, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/hooks/useAuth";

interface Props {
  profile: UserProfile;
}

const PendingExamBanner = ({ profile }: Props) => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from("exam_proposals")
        .select("*")
        .in("status", ["pending_teachers", "pending_coordinator"])
        .order("deadline", { ascending: true });

      if (!data) return;

      const myPending = data.filter(p => {
        const alreadyResponded = p.teacher_responses?.some((r: any) => r.teacher_id === profile.id);
        const isOverdue = new Date(p.deadline) < new Date();
        return !alreadyResponded && isOverdue;
      });

      setPending(myPending);
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [profile.id]);

  useEffect(() => {
    if (pending.length <= 1) return;
    const t = setInterval(() => {
      setCurrentIdx(i => (i + 1) % pending.length);
      setDismissed(false);
    }, 8000);
    return () => clearInterval(t);
  }, [pending.length]);

  if (!pending.length || dismissed) return null;

  const current = pending[currentIdx];
  const daysOverdue = Math.abs(Math.ceil((new Date(current.deadline).getTime() - Date.now()) / 86400000));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      >
        <div className="bg-destructive text-destructive-foreground rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-destructive-foreground/20">
            <motion.div
              className="h-full bg-destructive-foreground"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 8, ease: "linear" }}
            />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="text-2xl animate-bounce">📅</div>
                <div>
                  <p className="font-heading font-bold text-sm flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    נדרשת תגובתך — פג המועד לפני {daysOverdue} ימים!
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    תכנון מבחן: <strong>{current.subject}</strong> שכבה {current.grade}׳
                  </p>
                </div>
              </div>
              <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="flex-1 font-heading text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => { navigate("/dashboard/exam-planner"); setDismissed(true); }}
              >
                <Calendar className="h-3.5 w-3.5 ml-1" /> הגב עכשיו
              </Button>
              {pending.length > 1 && (
                <span className="self-center text-xs opacity-70">{currentIdx + 1}/{pending.length}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PendingExamBanner;
