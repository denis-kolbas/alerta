import { redirect } from 'next/navigation';

export default function SignupPage() {
  redirect('/register');
}

export const metadata = {
  title: 'Sign Up - Redirecting...',
};
