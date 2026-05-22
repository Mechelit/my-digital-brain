import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import { toast } from "sonner";

type Todo = {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "done";
  priority: "low" | "normal" | "high" | "urgent";
  source: "manual" | "mila" | "email";
  created_at: string;
};

export function TodosWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Todo[];
    },
  });

  const completeTodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("todos")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      toast.success("To-do afgevinkt ✓");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const priorityColor = (p: string) => {
    if (p === "urgent") return "text-red-500";
    if (p === "high") return "text-orange-400";
    if (p === "normal") return "text-muted-foreground";
    return "text-muted-foreground/60";
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ListTodo className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">To-do's</h2>
        {todos.length > 0 && (
          <span className="ml-auto text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
            {todos.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : todos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Geen openstaande to-do's. Vraag MILA om er een toe te voegen.
        </p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-start gap-3 group"
            >
              <button
                onClick={() => completeTodo.mutate(todo.id)}
                className="mt-0.5 flex-none text-muted-foreground hover:text-primary transition-colors"
                title="Afvinken"
              >
                <Circle className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug truncate">{todo.title}</p>
                {todo.description && (
                  <p className="text-xs text-muted-foreground truncate">{todo.description}</p>
                )}
              </div>
              <span className={`text-xs flex-none ${priorityColor(todo.priority)}`}>
                {todo.priority === "urgent" ? "🔴" : todo.priority === "high" ? "🟠" : ""}
              </span>
              {todo.source === "mila" && (
                <span className="text-xs text-muted-foreground/50 flex-none">MILA</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
