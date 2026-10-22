import { useId } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterOption = { value: string; label: string; icon: LucideIcon };

export default function PortfolioFilterSelect({ label, value, onValueChange, options }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
}) {
  const id = useId();
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block text-xs font-medium text-slate-600">{label}</label>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="group w-full min-w-0 rounded-[8px] border-slate-500 bg-white px-3 text-slate-900 shadow-none data-[size=default]:h-9 coarse-input:data-[size=default]:h-11 focus-visible:border-route focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 motion-reduce:transition-none [&>svg]:hidden">
        <SelectValue />
        <span aria-hidden="true" className="ml-auto shrink-0 text-slate-600">
          <ChevronDown className="size-4 rotate-90 transition-transform duration-220 ease-[cubic-bezier(0.2,0,0,1)] group-data-[state=open]:rotate-0 motion-reduce:transition-none" />
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="start" sideOffset={8} className="w-(--radix-select-trigger-width) rounded-[12px] border border-slate-300 bg-white p-1.5 text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.10)] ring-0 data-[side=bottom]:translate-y-0 data-[side=top]:-translate-y-0 duration-240 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:animate-none! [&_[data-radix-select-viewport]]:min-w-0">
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => <SelectItem key={optionValue} value={optionValue} className="mb-1 min-h-9 rounded-md py-2 pr-8 pl-3 text-sm leading-5 transition-colors duration-220 ease-[cubic-bezier(0.2,0,0,1)] last:mb-0 focus:bg-slate-100 focus:text-slate-900 data-[state=checked]:bg-route-quiet data-[state=checked]:text-route coarse-input:min-h-11 motion-reduce:transition-none">
          <Icon className="size-4 shrink-0" aria-hidden="true" /><span>{optionLabel}</span>
        </SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
