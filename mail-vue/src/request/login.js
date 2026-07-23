import http from '@/axios/index.js';

export function login(email, password, token) {
    return http.post('/login', {email: email, password: password, token})
}

export function logout() {
    return http.delete('/logout')
}
