export function TaskItemInfo({
  label,
  value,
  icon,
  textColor = "text-muted-foreground",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  textColor?: string;
  textBackground?: string;
}) {
  return (
    <div className={`text-xs flex items-center mt-1 flex-wrap ${textColor}`}>
      <span className="h-3 w-3 mr-1 flex-shrink-0">{icon}</span>
      <span className="break-words">
        {label} {value}
      </span>
    </div>
  );
}
