import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ message = "Something went wrong", onRetry }: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="py-12 text-center">
      <div className="size-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
        <AlertTriangle className="size-5 text-destructive/60" />
      </div>
      <div className="text-sm text-muted-foreground">{message}</div>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3 h-8 rounded-lg" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
