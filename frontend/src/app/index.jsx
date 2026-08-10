import React from 'react';
import { Redirect } from 'expo-router';

export default function Index() {
  // This instantly pushes every user directly to the Home screen
  return <Redirect href="/tabs/home" />;
}