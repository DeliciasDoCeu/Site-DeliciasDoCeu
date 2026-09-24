# Delícias do Céu

Cardápio em Cloudflare Pages, painel privado em Workers, dados em D1 e fotos em KV. Nenhum serviço pago é necessário. O login usa chaves de acesso (WebAuthn), sem Cloudflare Access, cartão ou senha compartilhada.

- Loja: https://delicias-do-ceu.pages.dev
- Painel: https://delicias-do-ceu-painel.ester-elsie05.workers.dev/admin/

## Para a dona da loja

1. Abra o convite privado no seu celular e toque em **Criar minha chave de acesso**. Confirme a biometria ou o PIN e salve a chave no seu gerenciador. O convite expira e funciona somente na primeira ativação. Não o divulgue.
2. Depois, use o endereço do painel e **Entrar com chave de acesso**. Uma sessão dura até 12 horas. **Sair** encerra a sessão no servidor.
3. Em **Adicionar doce**, informe foto, nome, descrição, preço e quantidade. Fotos JPEG, PNG e WebP são reduzidas no navegador antes do envio.
4. O campo de desconto é opcional: preço normal 25,00 e promocional 20,00 aparecem como “de R$ 25,00 por R$ 20,00”.
5. Adicione sabores quando necessário. Cada sabor tem seu próprio preço, desconto, estoque e opção ativo. O cliente escolhe o sabor antes de colocar no carrinho.
6. Em **Criar kit**, escolha os produtos, os sabores exatos e a quantidade de cada item. Defina preço e limite de kits. A disponibilidade considera também o estoque dos componentes. Kits não contêm outros kits.
7. **Inativar** esconde um item do cardápio sem apagar o cadastro ou a foto. Kits que dependem dele também ficam indisponíveis. Para voltar, abra **Inativos → Reativar**.
8. Quantidade **0** significa esgotado. Campo vazio significa estoque sob consulta. Os dois produtos existentes começam sob consulta porque não foi informada a quantidade real; cadastros novos começam com zero.

### Estoque e WhatsApp

Adicionar ao carrinho e abrir o WhatsApp **não reservam nem baixam estoque**. A dona confirma a venda e atualiza as quantidades no painel. Na venda de um kit, atualize os componentes e, quando houver um limite próprio do kit, também esse limite. O site impede que um mesmo carrinho exceda o estoque disponível, somando kits e avulsos, e confere preços e disponibilidade no servidor antes de abrir o WhatsApp. Pedidos simultâneos ainda precisam de confirmação da dona.

### Fotos e acesso

O painel avisa aos 90% do limite de **100 MB reservado por esta aplicação**. Esse indicador não representa o consumo total da conta Cloudflare. A limpeza remove apenas fotos sem vínculo com qualquer produto, ativo ou inativo, enviadas há mais de 24 horas. A exclusão é definitiva. O limite é conservador; a gratuidade também depende das cotas de requisições e operações da Cloudflare, que são compartilhadas com outros aplicativos da conta. Exceder uma cota gratuita pode interromper operações até a renovação; não há promessa de disponibilidade ilimitada.

Mantenha a chave sincronizada pelo gerenciador do celular, quando oferecido. É possível cadastrar até cinco chaves: entre novamente e use **Cadastrar outra chave de acesso** nos primeiros cinco minutos. A digital/PIN fica no dispositivo; o servidor guarda apenas a chave pública. O e-mail identifica a dona, mas conhecer esse e-mail não libera acesso. Se perder todas as chaves, a recuperação exige a conta Cloudflare e o responsável técnico; não há redefinição automática por e-mail.

## Desenvolvimento

Use Node.js 22.13+ (testado com 24), execute `npm ci`, `npm test`, `npm run build` e `npm run dev`. A prévia fica em `http://127.0.0.1:8766`, com painel em `/admin/` e dados separados em `.local/preview`. Somente essa prévia local dispensa autenticação. Nunca publique a variável `LOCAL_DEVELOPMENT`.

O build produz apenas os arquivos públicos em `dist/` e os arquivos do painel em `dist-admin/`. Pages deve usar `npm run build` e a pasta de saída `dist`, com Node 22.13+; nunca publique a raiz do repositório.

## Publicação e manutenção

- `worker/wrangler.jsonc` contém os IDs dos recursos, que não são credenciais. O segredo `ADMIN_EMAIL` é configurado diretamente no Worker, fora do Git.
- Inicialize tabelas sem apagar dados: `npx wrangler d1 execute delicias-do-ceu-catalogo --remote --file worker/schema.sql --config worker/wrangler.jsonc`.
- Publique o painel após build e testes: `npx wrangler deploy --config worker/wrangler.jsonc`.
- Configure a URL do Worker em `js/config.js` e publique o site pelo Git somente após o backend responder corretamente. Confira CORS, `/api/catalog`, `/api/quote`, `/auth/login` e bloqueio de `/api/admin/catalog` sem sessão.
- Convites iniciais são hashes de tokens aleatórios de 256 bits com validade curta, armazenados em `auth_invites`. O token completo fica somente no arquivo privado `.local/` entregue à dona. Não deve ser commitado nem aparecer em logs ou no site público.
- Prepare o convite com `node scripts/prepare-invite.mjs https://ENDERECO-DO-PAINEL`, importe `.local/invite.sql` com `wrangler d1 execute` e confirme `convite_criado = 1` antes de entregar `.local/ativar-painel.txt`. Esse procedimento não redefine chaves já cadastradas.
- Faça backup/exportação do D1 antes de manutenção ou recuperação. Para recuperação de acesso, confirme a identidade pela conta Cloudflare, revogue sessões e chaves antigas e gere novo convite. Não altere o catálogo durante a recuperação.

As alterações do catálogo usam revisão para impedir sobrescrita entre abas. Escritas exigem sessão válida, origem correta e validação no servidor. O login exige verificação do dispositivo, desafio de uso único, assinatura, domínio e origem exatos. Cookies são Secure, HttpOnly e SameSite=Strict; tokens de sessão ficam armazenados apenas como hash. As tentativas de login têm limite por IP.

Documentação: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [KV](https://developers.cloudflare.com/kv/platform/pricing/), [SimpleWebAuthn](https://simplewebauthn.dev/docs/advanced/passkeys).
