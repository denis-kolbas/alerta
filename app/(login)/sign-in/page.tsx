import { redirect } from 'next/navigation';

export default function SignInPage() {
  redirect('/login');
}

export const metadata = {
  title: 'Sign In - Redirecting...',
};