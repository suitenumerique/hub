import type { ChatUserFilters } from "../Driver";
import type { ChatMember, ChatUser } from "../types";

export const MOCK_CURRENT_CHAT_MEMBER: ChatMember = {
  id: "mock-current-user",
  name: "You",
  secondaryText: "La Suite",
};

export const MOCK_CHAT_USERS: ChatUser[] = [
  {
    id: "user-amandine-salambo",
    name: "Amandine Salambo",
    initials: "AS",
    email: "amandine.salambo@hub.local",
    subtitle: "Modernisation",
    color: "green",
  },
  {
    id: "user-amandine-korsgaard",
    name: "Amandine Korsgaard",
    initials: "AK",
    email: "amandine.korsgaard@hub.local",
    subtitle: "Digital - External",
    color: "orange",
  },
  {
    id: "user-amandine-aminoff",
    name: "Amandine Aminoff",
    initials: "AA",
    email: "amandine.aminoff@hub.local",
    subtitle: "Beta",
    color: "purple",
  },
  {
    id: "user-amed-roscow",
    name: "Amed Roscow",
    initials: "AR",
    email: "amed.roscow@hub.local",
    subtitle: "Beta",
    color: "yellow",
  },
  {
    id: "user-daniel-ferioux",
    name: "Daniel Ferioux",
    initials: "DF",
    email: "daniel.ferioux@hub.local",
    subtitle: "Modernisation",
    color: "blue-1",
  },
  {
    id: "user-didier-salambo",
    name: "Didier Salambo",
    initials: "DS",
    email: "didier.salambo@hub.local",
    subtitle: "Modernisation",
    color: "green",
  },
  {
    id: "user-anabelle-dupontel",
    name: "Anabelle Dupontel",
    initials: "AD",
    email: "anabelle.dupontel@hub.local",
    subtitle: "Produit",
    color: "pink",
  },
  {
    id: "user-andre-campan",
    name: "André Campan",
    initials: "AC",
    email: "andre.campan@hub.local",
    subtitle: "Incubateur",
    color: "brown",
  },
  {
    id: "user-edouard-mcdonald",
    name: "Edouard McDonald",
    initials: "EM",
    email: "edouard.mcdonald@hub.local",
    subtitle: "Incubateur",
    color: "blue-2",
  },
  {
    id: "user-jean-dustaff",
    name: "Jean Dustaff",
    initials: "JD",
    email: "jean.dustaff@hub.local",
    subtitle: "Ops",
    color: "gray",
  },
  {
    id: "user-berangere-becker",
    name: "Bérangère Becker",
    initials: "BB",
    email: "berangere.becker@hub.local",
    subtitle: "Support",
    color: "red",
  },
];

export const getMockChatMember = (id: string): ChatMember => {
  const user = MOCK_CHAT_USERS.find((candidate) => candidate.id === id);
  return {
    id,
    name: user?.name ?? id,
    secondaryText: user?.subtitle || user?.email || id,
  };
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();

const searchableValue = (user: ChatUser) =>
  normalize(`${user.name} ${user.email} ${user.subtitle}`);

export const getMockChatUsers = ({
  q = "",
  excludeIds = [],
}: ChatUserFilters = {}): ChatUser[] => {
  const query = normalize(q);
  if (!query) {
    return [];
  }

  const excluded = new Set(excludeIds);
  const terms = query.split(/\s+/).filter(Boolean);

  return MOCK_CHAT_USERS.filter((user) => !excluded.has(user.id))
    .filter((user) => {
      const haystack = searchableValue(user);
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => {
      const leftName = normalize(left.name);
      const rightName = normalize(right.name);
      const leftStarts = leftName.startsWith(query) ? 0 : 1;
      const rightStarts = rightName.startsWith(query) ? 0 : 1;

      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 5);
};
