const button = document.getElementById('loginButton');
const message = document.getElementById('loginMessage');
const params = new URLSearchParams(location.hash.slice(1));
const invite = params.get('convite');
const addKey = params.get('adicionar') === '1';
const registering = !!invite || addKey;
history.replaceState(null, '', location.pathname);
if (registering) {
  document.getElementById('loginTitle').textContent = addKey ? 'Cadastre outra chave.' : 'Bem-vinda à sua loja.';
  document.getElementById('loginDescription').textContent = 'Salve sua chave de acesso no seu celular ou gerenciador de senhas. A digital, o rosto ou o PIN confirmam que é você.';
  button.textContent = 'Criar minha chave de acesso';
}
async function post(path, data) {
  const response = await fetch('/api/auth/' + path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível entrar. Tente novamente.');
  return result;
}
button.addEventListener('click', async () => {
  button.disabled = true;
  message.hidden = false;
  message.textContent = 'Siga a confirmação de segurança do seu dispositivo.';
  try {
    if (!window.PublicKeyCredential) throw new Error('Abra este endereço no Chrome, Safari ou Edge atualizado para usar sua chave de acesso.');
    const mode = registering ? 'register' : 'login';
    const { options } = await post(mode + '/options', { invite });
    const response = registering ? await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options }) : await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });
    await post(mode + '/verify', { response });
    location.replace('/admin/');
  } catch (cause) {
    message.textContent = cause.name === 'NotAllowedError' ? 'A confirmação foi cancelada ou expirou. Você pode tentar novamente.' : cause.message;
    button.disabled = false;
  }
});
