// src/utils/homeHelpers.js

export const normalizeString = (str) => {
    if (!str) return '';
    return str.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
};

export const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const safeFetchJson = (endpoint, options = {}) => {
    const primaryBase = 'https://jiosaavn-api-47fm.onrender.com/api';
    const fallbackBase = 'https://saavn.sumit.co/api';

    const fetchApi = async (baseUrl) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${baseUrl}${endpoint}`, { ...options, signal: controller.signal });
        clearTimeout(id);
        if (!res.ok) throw new Error('Not ok');
        return JSON.parse(await res.text());
    };

    return new Promise((resolve) => {
        let failedCount = 0;
        const handleSuccess = (data) => { if (data && data.success) resolve(data); else handleError(); };
        const handleError = () => {
            failedCount++;
            if (failedCount === 2) resolve({ success: false, data: { results: [] } });
        };
        fetchApi(primaryBase).then(handleSuccess).catch(handleError);
        fetchApi(fallbackBase).then(handleSuccess).catch(handleError);
    });
};

export const MOCK_LANGUAGES = [
    { id: 'l1', title: 'Hindi', code: 'hi', subtitle: 'हिन्दी', fallbackImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=60', color: '#323246' },
    { id: 'l2', title: 'English', code: 'en', subtitle: 'Hollywood', fallbackImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=60', color: '#5A3732' },
    { id: 'l3', title: 'Tamil', code: 'ta', subtitle: 'தமிழ்', fallbackImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=60', color: '#4A3428' },
    { id: 'l4', title: 'Telugu', code: 'te', subtitle: 'తెలుగు', fallbackImage: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=300&q=60', color: '#2C3E50' },
    { id: 'l5', title: 'Punjabi', code: 'pa', subtitle: 'ਪੰਜਾਬੀ', fallbackImage: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=300&q=60', color: '#4A4A28' },
    { id: 'l6', title: 'Malayalam', code: 'ml', subtitle: 'മലയാളം', fallbackImage: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=300&q=60', color: '#284A3B' },
];

export const TOP_ARTISTS = [
    { id: 'a1', name: 'Arijit Singh', image: 'https://c.saavncdn.com/artists/Arijit_Singh_500x500.jpg' },
    { id: 'a2', name: 'Shreya Ghoshal', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_500x500.jpg' },
    { id: 'a3', name: 'KK', image: 'https://c.saavncdn.com/artists/KK_500x500.jpg' },
    { id: 'a4', name: 'Sonu Nigam', image: 'https://c.saavncdn.com/artists/Sonu_Nigam_500x500.jpg' },
    { id: 'a5', name: 'Armaan Malik', image: 'https://c.saavncdn.com/artists/Armaan_Malik_500x500.jpg' },
    { id: 'a6', name: 'Udit Narayan', image: 'https://c.saavncdn.com/artists/Udit_Narayan_500x500.jpg' },
    { id: 'a7', name: 'Kumar Sanu', image: 'https://c.saavncdn.com/artists/Kumar_Sanu_500x500.jpg' },
    { id: 'a8', name: 'Alka Yagnik', image: 'https://c.saavncdn.com/artists/Alka_Yagnik_500x500.jpg' },
    { id: 'a9', name: 'Abhijeet Bhattacharya', image: 'https://i.scdn.co/image/ab6761610000e5eb0300a78ed8fc1b9cc0f39384' },
    { id: 'a10', name: 'Shankar Mahadevan', image: 'https://c.saavncdn.com/artists/Shankar_Mahadevan_500x500.jpg' },
    { id: 'a11', name: 'Javed Ali', image: 'https://c.saavncdn.com/artists/Javed_Ali_500x500.jpg' },
    { id: 'a12', name: 'Mohit Chauhan', image: 'https://c.saavncdn.com/artists/Mohit_Chauhan_500x500.jpg' },
    { id: 'a13', name: 'Jubin Nautiyal', image: 'https://i.scdn.co/image/ab6761610000e5eb56eecf73fcdd401eb124af0d' },
    { id: 'a14', name: 'Atif Aslam', image: 'https://c.saavncdn.com/artists/Atif_Aslam_500x500.jpg' },
    { id: 'a15', name: 'Rahat Fateh Ali Khan', image: 'https://c.saavncdn.com/artists/Rahat_Fateh_Ali_Khan_500x500.jpg' },
    { id: 'a16', name: 'Nusrat Fateh Ali Khan', image: 'https://c.saavncdn.com/artists/Nusrat_Fateh_Ali_Khan_500x500.jpg' },
    { id: 'a17', name: 'Kishore Kumar', image: 'https://c.saavncdn.com/artists/Kishore_Kumar_500x500.jpg' },
    { id: 'a18', name: 'Mohammad Rafi', image: 'https://c.saavncdn.com/artists/Mohammed_Rafi_500x500.jpg' },
    { id: 'a19', name: 'Lata Mangeshkar', image: 'https://c.saavncdn.com/artists/Lata_Mangeshkar_500x500.jpg' },
    { id: 'a20', name: 'Asha Bhosle', image: 'https://c.saavncdn.com/artists/Asha_Bhosle_500x500.jpg' },
    { id: 'a21', name: 'Yo Yo Honey Singh', image: 'https://c.saavncdn.com/artists/Yo_Yo_Honey_Singh_500x500.jpg' },
    { id: 'a22', name: 'Badshah', image: 'https://c.saavncdn.com/artists/Badshah_500x500.jpg' },
    { id: 'a23', name: 'Karan Aujla', image: 'https://i.scdn.co/image/ab6761610000e5eb1eabffcd8cc5951d8b2d7119' },
    { id: 'a24', name: 'Diljit Dosanjh', image: 'https://i.scdn.co/image/ab6761610000e5ebb5b8f60183b0f581cd11ba90' },
    { id: 'a25', name: 'Guru Randhawa', image: 'https://c.saavncdn.com/artists/Guru_Randhawa_500x500.jpg' },
    { id: 'a26', name: 'Jass Manak', image: 'https://i.scdn.co/image/ab6761610000e5ebdd2720d297b864a275b9f939' },
    { id: 'a27', name: 'Shafqat Amanat Ali', image: 'https://c.saavncdn.com/artists/Shafqat_Amanat_Ali_500x500.jpg' },
    { id: 'a28', name: 'Pritam', image: 'https://i.scdn.co/image/ab6761610000e5ebcb6926f44f620555ba444fcd' },
    { id: 'a29', name: 'Emraan Hashmi', image: 'https://c.saavncdn.com/artists/Emraan_Hashmi_500x500.jpg' },
    { id: 'a30', name: 'Himesh Reshammiya', image: 'https://c.saavncdn.com/artists/Himesh_Reshammiya_500x500.jpg' },
    { id: 'a31', name: 'Sunidhi Chauhan', image: 'https://c.saavncdn.com/artists/Sunidhi_Chauhan_500x500.jpg' },
];