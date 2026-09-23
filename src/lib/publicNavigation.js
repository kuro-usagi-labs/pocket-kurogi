export function getPublicPage(search = '') {
  const params = new URLSearchParams(search)
  if (params.has('token') || params.has('auth') || params.has('error')) return 'login'
  return ['login', 'register'].includes(params.get('page')) ? params.get('page') : 'home'
}
