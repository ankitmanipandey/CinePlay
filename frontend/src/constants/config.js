export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
export const TMDB_IMAGE_BASE_URL_ORIGINAL = 'https://image.tmdb.org/t/p/original';

export const getImageUrl = (path, size = 'w500') => {
    if (!path) return null;
    return size === 'original'
        ? `${TMDB_IMAGE_BASE_URL_ORIGINAL}${path}`
        : `${TMDB_IMAGE_BASE_URL}${path}`;
};