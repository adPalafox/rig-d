type Props = {
  color: string;
};

export function AgentStickman({ color }: Props) {
  return (
    <svg className="agent-stickman" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="20" r="11" stroke="#1e1b16" strokeWidth="4" />
      <path d="M39 17C47 10 58 10 66 17" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <path d="M50 32V60" stroke="#1e1b16" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 45L50 38L68 45" stroke="#1e1b16" strokeWidth="4" strokeLinecap="round" />
      <path d="M38 84L50 60L62 84" stroke="#1e1b16" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 50L18 42" stroke="#1e1b16" strokeWidth="4" strokeLinecap="round" />
      <path d="M72 50L82 35" stroke="#1e1b16" strokeWidth="4" strokeLinecap="round" />
      <path d="M78 28L89 25L84 36" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
