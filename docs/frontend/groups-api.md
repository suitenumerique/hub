# Groupes : brancher le front sur le backend du Hub

Issue #173 (parent #30 ; création #32, réglages #33, membres #34).

Les écrans des groupes sont prêts, mais **aucune route n'est appelée** : chaque
appel est remplacé par un `console.log`. Le front ne crée aucune salle Matrix,
n'invite personne et ne change aucun power level : c'est le backend qui le fait.

## 1. Brancher les routes

Tout est dans `src/frontend/apps/hub/src/features/config/HubApi.ts`. Chaque
méthode contient le `console.log` et, juste en dessous, l'appel prêt à
décommenter. Pour chaque méthode :

1. décommenter l'appel `fetchAPI` et vérifier l'adresse ;
2. supprimer le `console.log` et le `return` provisoire.

`fetchAPI` ajoute le préfixe `/api/v1.0/`, le cookie de session et le jeton
CSRF. `redirectOn40x: false` évite qu'un 401 ou un 403 sur une action de groupe
envoie toute l'application vers `/401` ou `/403`. Une réponse en erreur lève une
`APIError` : les modales affichent alors leur message d'erreur.

| Action                      | Méthode `HubApi`     | Route proposée                           | Corps                     | Réponse         |
| --------------------------- | -------------------- | ---------------------------------------- | ------------------------- | --------------- |
| Lister mes groupes          | `getGroups`          | `GET groups/`                            | —                         | `Group[]`       |
| Créer                       | `createGroup`        | `POST groups/`                           | `CreateGroupPayload`      | `Group`         |
| Modifier nom et emoji       | `updateGroup`        | `PATCH groups/<id>/`                     | `UpdateGroupPayload`      | `Group`         |
| Lister les membres          | `getGroupAccesses`   | `GET groups/<id>/accesses/`              | —                         | `GroupAccess[]` |
| Ajouter des membres         | `addGroupAccesses`   | `POST groups/<id>/accesses/`             | `AddGroupAccessesPayload` | (non lue)       |
| Changer un rôle             | `updateGroupAccess`  | `PATCH groups/<id>/accesses/<acces_id>/` | `{ role }`                | (non lue)       |
| Retirer un membre           | `deleteGroupAccess`  | `DELETE groups/<id>/accesses/<acces_id>/`| —                         | (non lue)       |

Les réponses sont des tableaux JSON, sans pagination. Les types sont dans
`src/frontend/apps/hub/src/features/groups/types.ts` : c'est là qu'on les
modifie si le contrat diffère. TypeScript signale alors les endroits à reprendre.

```ts
type GroupRole = "administrator" | "member";

type Group = {
  id: string;
  name: string;
  emoji: string;
  user_role: GroupRole; // rôle de l'utilisateur courant
  matrix: { room_id: string } | null; // la conversation du groupe
};

type GroupUser = { id: string; full_name: string; email: string };
type GroupAccess = { id: string; role: GroupRole; user: GroupUser };

type CreateGroupPayload = {
  matrix_account_id: string; // compte de chat du front, ex. "matrix-local"
  name: string;
  emoji: string;
  invitees: string[]; // identifiants Matrix, sans l'utilisateur courant
};
type UpdateGroupPayload = { name: string; emoji: string };
type AddGroupAccessesPayload = { user_ids: string[]; role: GroupRole };
```

## 2. Comment une conversation est reconnue comme un groupe

Les conversations viennent toujours de Matrix, comme avant. `getGroups` dit
seulement lesquelles sont des groupes : celles dont l'identifiant de salle est
un `matrix.room_id` (`useGroupForChat`, dans `hooks/useGroups.ts`). L'appel ne
part que pour une conversation qui n'est pas directe, et sa réponse est gardée
une minute.

- **Réglages et membres** : proposés dans l'en-tête de la conversation. Les
  réglages et les actions sur les membres sont réservés à `user_role ===
  "administrator"` ; c'est au backend de refuser les autres (403).
- **Après une création** : si la réponse contient `matrix`, le front attend que
  le driver Matrix connaisse la salle (15 s au plus) puis l'ouvre
  (`hooks/useOpenGroupConversation.ts`).
- **Pas fait** : l'emoji du groupe n'est pas encore appliqué à la liste de
  gauche pour les vrais groupes.

## 3. Les deux groupes de démonstration

`src/frontend/apps/hub/src/features/groups/demoGroups.ts` contient deux groupes
écrits en dur, en tête de la liste des conversations :

- « Groupe démo (admin) » : réglages et gestion des membres disponibles ;
- « Groupe démo (membre) » : membres en lecture seule, pas de réglages.

Ils n'ont pas de salle Matrix. Leur conversation est vide, et les actions sur
la conversation elle-même (favoris, non lu) affichent une erreur : seules les
modales de groupe sont à tester. Rien n'est enregistré : ajouter ou retirer un membre, modifier
un nom ou créer un groupe envoie le `console.log` sans changer l'affichage.

Une fois les routes branchées, supprimer `demoGroups.ts` et
`components/DemoGroupView.tsx`, puis les endroits que TypeScript signale
(`HubApi.ts`, `LeftPanel.tsx`, `ChatSurface.tsx`).

## 4. Vérifier les appels

Ouvrir la console du navigateur et filtrer sur `[groups]`. Chaque action affiche
la route et le corps qui partiraient, par exemple :

```text
[groups] POST groups/ {matrix_account_id: "matrix-local", name: "Projet Fusée", emoji: "🌲", invitees: [...]}
```

## 5. Écarts avec le POC `origin/qbey/group-hub-matrix`

- `groups/` au lieu de `<backend_hrid>/groups/` ;
- pas de `matrix_access_token` à la création : l'ajouter à
  `CreateGroupPayload` et dans `components/CreateGroupModal.tsx` si le backend
  en a besoin ;
- `allow_external_guests` et `is_encrypted` absents (hors périmètre) ;
- `user_role` en plus dans la réponse ; `visibility`, `rooms` et `matrix.via`
  ne sont pas lus ;
- rôles `administrator` / `member`, alors que le POC utilise ceux de lasuite
  (`reader`, `editor`, `administrator`, `owner`) : changer `GroupRole` et
  `GROUP_ROLES` dans `types.ts` si on les garde ;
- les routes des membres (`accesses/`) n'existent pas dans le POC.
