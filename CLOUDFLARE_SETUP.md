# Configuração do Contador Compartilhado

O projeto continua sendo uma aplicação estática do Cloudflare Pages. A persistência agora fica em um único Durable Object chamado `RelationshipCounter`, no Worker `shared-couple-counter`.

Não há login, senha ou autenticação. Qualquer pessoa com acesso ao site pode consultar, alterar ou resetar o contador, conforme solicitado.

## Estrutura criada

- `functions/api/state.js`: `GET /api/state`.
- `functions/api/action.js`: `POST /api/action`.
- `functions/_shared/counter.js`: acesso determinístico ao objeto compartilhado e respostas HTTP.
- `cloudflare/counter-worker/src/index.js`: Worker que exporta `RelationshipCounter`.
- `cloudflare/counter-worker/wrangler.jsonc`: configuração do Worker e armazenamento SQLite do Durable Object.
- `wrangler.jsonc`: configuração do Pages, incluindo o binding `RELATIONSHIP_COUNTER`.

O estado persistido mantém os mesmos campos usados pelo site:

```js
{
  ygor,
  julianne,
  apologies,
  peaceWins,
  recordDays,
  lastFightDate,
  memories
}
```

As ações são aplicadas dentro do Durable Object, sem enviar o estado inteiro pelo navegador:

- `offense`: registra uma ofensa, atualiza a data e cria a memória correspondente.
- `peace`: reduz a contagem sem ficar abaixo de zero, incrementa pedidos de desculpa e vitórias da paz.
- `reset`: reproduz o comportamento atual e zera também as memórias.

## Pré-requisitos

1. Ter uma conta Cloudflare com acesso a Workers & Pages.
2. Ter o Wrangler disponível por `npx` ou instalado no projeto.
3. Fazer login uma vez:

```powershell
npx wrangler login
```

Nenhum `account_id`, `namespace_id` ou segredo foi inventado no repositório.

## Deploy do Durable Object

A partir da raiz do projeto, publique primeiro o Worker que exporta o Durable Object:

```powershell
npx wrangler deploy --config cloudflare/counter-worker/wrangler.jsonc
```

O nome esperado do Worker é:

```text
shared-couple-counter
```

O arquivo usa o formato declarativo atual de Durable Objects com armazenamento SQLite. O namespace é criado/gerenciado pelo deploy do Worker.

## Criar e publicar o Pages

O nome desejado foi configurado como:

```text
contadordeofensas
```

Se o projeto ainda não existir:

```powershell
npx wrangler pages project create contadordeofensas
```

Depois publique a aplicação a partir da raiz:

```powershell
npx wrangler pages deploy . --project-name contadordeofensas
```

A URL esperada será:

```text
https://contadordeofensas.pages.dev
```

O nome precisa estar disponível na Cloudflare. Se `contadordeofensas` já estiver ocupado, o comando não deve ser substituído por um nome aleatório. Escolha manualmente outro nome no painel ou informe a disponibilidade antes de criar o projeto.

## Binding do Durable Object no Pages

O `wrangler.jsonc` da raiz já declara:

```jsonc
{
  "name": "RELATIONSHIP_COUNTER",
  "class_name": "RelationshipCounter",
  "script_name": "shared-couple-counter"
}
```

Quando o Pages for configurado pelo painel, confira também:

1. Acesse **Workers & Pages** no painel Cloudflare.
2. Abra o projeto Pages `contadordeofensas`.
3. Entre em **Settings**.
4. Abra **Bindings**.
5. Clique em **Add** e selecione **Durable Object**.
6. Em **Variable name**, use exatamente `RELATIONSHIP_COUNTER`.
7. Selecione o namespace do Worker `shared-couple-counter`.
8. Se o painel solicitar a classe, selecione `RelationshipCounter`.
9. Repita a configuração para Production e Preview quando ambos forem usados.
10. Faça um novo deploy do Pages.

Se o Wrangler estiver sendo usado como fonte de configuração, mantenha o `wrangler.jsonc` como referência e não altere o mesmo binding de forma conflitante no painel.

## Desenvolvimento local

Abra dois terminais na raiz do projeto.

Terminal 1 — Worker do Durable Object:

```powershell
npx wrangler dev --config cloudflare/counter-worker/wrangler.jsonc
```

Terminal 2 — Cloudflare Pages com o binding local:

```powershell
npx wrangler pages dev . --do RELATIONSHIP_COUNTER=RelationshipCounter@shared-couple-counter --port 8788
```

Abra:

```text
http://localhost:8788
```

O binding `--do` conecta a Function do Pages ao Worker local pelo nome do Worker e da classe. O armazenamento local do Durable Object fica na área local do Wrangler.

Teste inicial:

```powershell
curl.exe http://localhost:8788/api/state
```

Teste de uma ação:

```powershell
curl.exe -X POST http://localhost:8788/api/action -H "Content-Type: application/json" -d "{\"type\":\"offense\",\"person\":\"ygor\"}"
```

## Sincronização

O navegador busca o estado ao abrir, ao voltar para a aba e aproximadamente a cada 5 segundos enquanto a aba está visível. O último estado conhecido permanece na interface quando a rede falha; nenhuma alteração é guardada silenciosamente no navegador.

As respostas da API usam `Cache-Control: no-store`. O frontend só re-renderiza as memórias e valores quando o estado recebido realmente mudou.

## Teste entre dois clientes

Use duas janelas ou dois dispositivos apontando para a mesma URL:

1. Ambos carregam `/api/state`.
2. Cliente A registra uma ofensa de Ygor.
3. Cliente B recebe a alteração pelo polling ou ao voltar para a aba.
4. Cliente B escolhe a paz para Julianne.
5. Cliente A recebe os novos contadores, estatísticas e memória.
6. Teste duas ações simultâneas de ofensa para a mesma pessoa.
7. Confirme que duas ações incrementam duas vezes, sem uma sobrescrever a outra.
8. Use **Resetar contagem** e confirme que os dois clientes recebem o estado zerado.
9. Recarregue os dois clientes e confirme a persistência.

## Fontes oficiais

- [Durable Objects — Getting started](https://developers.cloudflare.com/durable-objects/get-started/)
- [Cloudflare Pages — Bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Pages — Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
