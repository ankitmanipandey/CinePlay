import axios from 'axios';
import { TMDB_BASE_URL } from '../constants/config';

// TMDB Axios Instance
export const tmdbClient = axios.create({
    baseURL: TMDB_BASE_URL,
    headers: {
        accept: 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN}`
    }
});

// Your Backend Axios Instance (for Login/Signup)
export const backendClient = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});