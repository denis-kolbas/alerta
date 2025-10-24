import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item';

interface NotificationBannerProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'success' | 'info' | 'warning' | 'neutral' | 'dark';
}

export function NotificationBanner({ 
  icon: Icon, 
  title, 
  description, 
  action,
  variant = 'default' 
}: NotificationBannerProps) {
  const getGradientClass = () => {
    switch (variant) {
      case 'success':
        return 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-200 shadow-sm';
      case 'info':
        return 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200 shadow-sm';
      case 'warning':
        return 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200 shadow-sm';
      case 'neutral':
        return 'bg-card border-border shadow-sm';
      case 'dark':
        return 'bg-gradient-to-r from-[#002f5d] to-[#011c3a] border-[#002f5d] shadow-lg';
      default:
        return 'bg-gradient-to-br from-purple-50 via-violet-50 to-purple-100 border-purple-200 shadow-sm';
    }
  };

  const getIconColorClass = () => {
    switch (variant) {
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'info':
        return 'text-blue-600 bg-blue-100';
      case 'warning':
        return 'text-orange-600 bg-orange-100';
      case 'neutral':
        return 'text-primary bg-primary/10';
      case 'dark':
        return 'text-blue-300 bg-blue-900/30';
      default:
        return 'text-purple-600 bg-purple-100';
    }
  };

  const getTitleColorClass = () => {
    switch (variant) {
      case 'success':
        return 'text-green-900';
      case 'info':
        return 'text-blue-900';
      case 'warning':
        return 'text-orange-900';
      case 'neutral':
        return 'text-gray-900';
      case 'dark':
        return 'text-white';
      default:
        return 'text-purple-900';
    }
  };

  const getDescriptionColorClass = () => {
    switch (variant) {
      case 'success':
        return 'text-green-700';
      case 'info':
        return 'text-blue-700';
      case 'warning':
        return 'text-orange-700';
      case 'neutral':
        return 'text-gray-600';
      case 'dark':
        return 'text-blue-100';
      default:
        return 'text-purple-700';
    }
  };

  return (
    <Item className={getGradientClass()}>
      {Icon && (
        <ItemMedia>
          <div className={`rounded-full p-2 ${getIconColorClass()}`}>
            <Icon className="h-5 w-5" />
          </div>
        </ItemMedia>
      )}
      <ItemContent>
        <ItemTitle className={getTitleColorClass()}>{title}</ItemTitle>
        {description && (
          <ItemDescription className={getDescriptionColorClass()}>
            {description}
          </ItemDescription>
        )}
      </ItemContent>
      {action && <ItemActions>{action}</ItemActions>}
    </Item>
  );
}
