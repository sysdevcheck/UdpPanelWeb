
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function getSession() {
  return cookies().get('session');
}

export async function logout() {
  cookies().delete('session');
  redirect('/login');
}

export async function login(prevState: { error: string } | undefined, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Usuario y contraseña son requeridos.' };
  }
  
  try {
    // Construct the absolute URL for the API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/login`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      // Pass cookies from the incoming request to the fetch call
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Ocurrió un error en el servidor.' };
    }
    
    // The API route sets the cookie, so we just need to redirect
  } catch (error: any) {
    console.error('Login action error:', error);
    return { error: 'No se pudo conectar con el servidor de autenticación.' };
  }

  // If login is successful, redirect to home page
  redirect('/');
}
