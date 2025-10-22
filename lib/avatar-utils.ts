// Helper functions for avatar generation

export function getInitials(name: string | null | undefined, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  
  return '??';
}

export function getWorkspaceInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 1).toUpperCase();
}

export function getAvatarColor(text: string): string {
  // Generate a consistent, soft color based on the text
  const colors = [
    'bg-slate-200 text-slate-700',
    'bg-blue-200 text-blue-700',
    'bg-indigo-200 text-indigo-700',
    'bg-violet-200 text-violet-700',
    'bg-purple-200 text-purple-700',
    'bg-fuchsia-200 text-fuchsia-700',
    'bg-rose-200 text-rose-700',
    'bg-orange-200 text-orange-700',
    'bg-amber-200 text-amber-700',
    'bg-emerald-200 text-emerald-700',
    'bg-teal-200 text-teal-700',
    'bg-cyan-200 text-cyan-700',
  ];
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
