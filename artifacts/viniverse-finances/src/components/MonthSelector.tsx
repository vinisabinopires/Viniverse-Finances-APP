import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthYear } from "@/utils";
import { Button } from "@/components/ui/button";

interface MonthSelectorProps {
  currentDate: Date;
  onChange: (date: Date) => void;
}

export function MonthSelector({ currentDate, onChange }: MonthSelectorProps) {
  const prevMonth = () => {
    onChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="flex items-center justify-between py-2 px-4 glass-card rounded-full mx-auto w-max mb-6">
      <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="font-medium text-sm min-w-[120px] text-center">
        {formatMonthYear(currentDate.toISOString())}
      </span>
      <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground">
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
