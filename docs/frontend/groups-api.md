# Groupes : brancher le front sur le backend du Hub

Issue #173 (parent #30 ; création #32, réglages #33, membres #34, fichiers
Drive #35).

Les écrans des groupes sont prêts, mais **aucune route n'est appelée** : chaque
appel est remplacé par un `console.log`. Le front ne crée aucune salle Matrix,
n'invite personne et ne change aucun power level : c'est le backend qui le fait.
Seul doute : `updateGroup` et `getGroupAccesses`, qui ont aussi une version
Matrix (voir « Hub ou Matrix ? » plus bas).

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
| Lister les fichiers Drive   | `getGroupFiles`      | `GET groups/<id>/files/`                 | —                         | `GroupFile[]`   |

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

type GroupUser = {
  id: string; // identifiant Matrix (@nom:serveur), pas un id du Hub
  full_name: string;
  email: string;
};
type GroupAccess = { id: string; role: GroupRole; user: GroupUser };

type CreateGroupPayload = {
  matrix_account_id: string; // compte de chat du front, ex. "matrix-local"
  name: string;
  emoji: string;
  invitees: string[]; // identifiants Matrix, sans l'utilisateur courant
};
type UpdateGroupPayload = { name: string; emoji: string };
type AddGroupAccessesPayload = {
  user_ids: string[]; // identifiants Matrix
  role: GroupRole;
};

type GroupFile = {
  id: string; // identifiant de l'élément dans Drive
  title: string; // avec l'extension, masquée à l'affichage
  type: "file" | "folder";
  mimetype: string | null; // null pour un dossier, "lasuite/docs" pour Docs
  computed_link_reach: "restricted" | "authenticated" | "public" | null;
  drive_url: string; // page de l'élément dans Drive
};
```

Les personnes sont toujours désignées par leur **identifiant Matrix**, dans les
corps envoyés comme dans `GroupUser.id`. La recherche de la modale des membres
s'en sert pour ne pas reproposer les membres déjà présents : avec un id du Hub,
ils réapparaîtraient dans les résultats.

### Hub ou Matrix ? Deux méthodes à trancher

En écrivant ce squelette, **je ne savais pas si `updateGroup` et
`getGroupAccesses` passeraient par le Hub ou iraient directement à Matrix**. Les
deux versions sont donc dans `HubApi.ts`, commentées : en garder une et supprimer
l'autre. Le POC et son ADR 0003 (brouillon) penchent vers Matrix : le POC renomme
la salle depuis le front et lit les membres avec le driver, mais leurs rôles
viennent du Hub.

- **Version 1, le Hub** : décommenter l'appel `fetchAPI`, puis supprimer les
  blocs `[groups:matrix]` et le paramètre `chatRef` (il ne sert qu'à Matrix).
- **Version 2, Matrix** : décommenter tous les blocs `[groups:matrix]`
  (`HubApi.ts`, `Driver.ts`, `LazyMatrixDriver.ts`, `MatrixDriver.ts`). Si une
  seule des deux méthodes va vers Matrix, n'y décommenter que la sienne.

Si c'est Matrix :

- **Écriture** : `updateGroup` change le nom de la salle (`m.room.name`) et
  l'emoji (`fr.gouv.lasuite.hub.group.metadata`, l'événement du POC). Il faut
  un power level suffisant (50 dans le POC), sinon Matrix refuse et la modale
  affiche son erreur.
- **Nom côté Hub** : les réglages sont préremplis par `getGroups`. Ils montrent
  l'ancien nom tant que le Hub n'a pas vu le changement.
- **Rôles** : déduits du power level, administrateur à partir de 50. Les
  personnes invitées qui n'ont pas encore rejoint sont dans la liste, et le bot
  du Hub aussi s'il est dans la salle : à filtrer.
- **`<acces_id>`** : `GroupAccess.id` devient l'identifiant Matrix du membre, et
  c'est lui que reçoivent le changement de rôle et le retrait.
- **Rafraîchissement** : la liste est relue juste après chaque action, alors que
  Matrix peut n'avoir pas encore synchronisé. Il faudra aussi la relire sur
  l'événement `members:changed` du driver.

## 2. Comment une conversation est reconnue comme un groupe

Les conversations viennent toujours de Matrix, comme avant. `getGroups` dit
seulement lesquelles sont des groupes : celles dont l'identifiant de salle est
un `matrix.room_id` (`useGroupForChat`, dans `hooks/useGroups.ts`). L'appel ne
part que pour une conversation qui n'est pas directe, et sa réponse est gardée
une minute.

- **Réglages et membres** : proposés dans l'en-tête de la conversation. Les
  réglages et les actions sur les membres sont réservés à `user_role ===
  "administrator"` ; c'est au backend de refuser les autres (403).
- **Nom affiché** : l'en-tête et la liste de gauche montrent le nom de la salle
  Matrix ; `Group.name` ne fait que préremplir les réglages. Si le `PATCH` passe
  par le Hub, il doit donc aussi **renommer la salle**, sinon rien ne change à
  l'écran.
- **Après une création** : si la réponse contient `matrix`, le front attend que
  le driver Matrix connaisse la salle (15 s au plus) puis l'ouvre
  (`hooks/useOpenGroupConversation.ts`).
- **Pas fait** : l'emoji du groupe n'est pas encore appliqué à la liste de
  gauche pour les vrais groupes.

## 3. Les fichiers Drive du groupe

Le bouton « Drive » de l'en-tête, à côté des fils de réponses, n'existe que pour
un groupe. Il ouvre la liste des fichiers de Drive partagés avec ce groupe
(`components/GroupFilesTool.tsx`). `getGroupFiles` part à l'ouverture du panneau.
Un clic sur un fichier, un clic droit ou son bouton « … » l'ouvre dans Drive,
dans un nouvel onglet.

- **Champs** : `title`, `type`, `mimetype` et `computed_link_reach` portent le
  nom qu'ils ont dans l'API de Drive. `public` affiche le globe.
- **`drive_url`** : à construire par le backend. Ce n'est pas le `url` de Drive,
  qui télécharge le fichier. Les pages de Drive sont `/explorer/items/<id>` pour
  un dossier et `/explorer/items/files/<id>` pour un fichier.
- **Icône** : choisie par l'ui-kit (`FileIcon`) selon `mimetype` et, pour Grist
  par exemple, l'extension de `title`.
- **À voir avec l'équipe Drive** : son API externe
  (`/external_api/v1.0/items/`, `docs/resource_server.md` dans son dépôt) ne
  décrit que des accès par utilisateur ou par invitation, pas par groupe.
- **Pas fait** : les fichiers épinglés ; le bouton dans les conversations à deux
  (prévu par #35) ; la vignette des images ; les fichiers suspects et les
  dossiers restreints ; la pagination.

## 4. Les deux groupes de démonstration

`src/frontend/apps/hub/src/features/groups/demoGroups.ts` contient deux groupes
écrits en dur, en tête de la liste des conversations :

- « Groupe démo (admin) » : réglages et gestion des membres disponibles ;
- « Groupe démo (membre) » : membres en lecture seule, pas de réglages.

Ils n'ont pas de salle Matrix. Leur conversation est vide, et les actions sur
la conversation elle-même (favoris, non lu) affichent une erreur : seuls les
modales de groupe et le panneau Drive sont à tester. Rien n'est enregistré :
ajouter ou retirer un membre, modifier un nom ou créer un groupe envoie le
`console.log` sans changer l'affichage.

Leur panneau Drive montre les mêmes 15 fichiers fictifs (`DEMO_FILES`), avec
toutes les icônes de l'ui-kit sauf le fichier suspect et le dossier restreint.
Ils ouvrent tous la page d'accueil de Fichiers.

Une fois les routes branchées, supprimer `demoGroups.ts` et
`components/DemoGroupView.tsx`, puis les endroits que TypeScript signale
(`HubApi.ts`, `LeftPanel.tsx`, `ChatSurface.tsx`).

## 5. Vérifier les appels

Ouvrir la console du navigateur et filtrer sur `[groups]`. Chaque action affiche
la route et le corps qui partiraient, par exemple :

```text
[groups] POST groups/ {matrix_account_id: "matrix-local", name: "Projet Fusée", emoji: "🌲", invitees: [...]}
[groups] PATCH groups/demo-admin/ (or Matrix room demo-group-admin) {name: "Projet Fusée", emoji: "🌲"}
```

Le second montre les deux destinations possibles : la route du Hub, ou la salle.

## 6. Écarts avec le POC `origin/qbey/group-hub-matrix`

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
