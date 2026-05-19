export interface HsUser {
  id: string;
  name: string;
  createdAt: string;
}

export interface HsNode {
  id: string;
  name: string;
  givenName: string;
  user: HsUser;
  lastSeen: string;         // RFC3339
  expiry: string;           // RFC3339
  ipAddresses: string[];
  registerMethod: string;
  validTags: string[];
  invalidTags: string[];
  forcedTags: string[];
  createdAt: string;
  online: boolean;
}

export interface HsPreAuthKey {
  user: string;
  id: string;
  key: string;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  aclTags: string[];
}

export interface HsRoute {
  id: string;
  node: HsNode;
  prefix: string;
  advertised: boolean;
  enabled: boolean;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface HsApiKey {
  id: string;
  prefix: string;
  expiration: string;
  createdAt: string;
  lastSeen?: string;
}

export interface HsDnsConfig {
  nameservers: string[];
  restricted_nameservers: Record<string, string[]>;
  domains: string[];
  magic_dns: boolean;
  base_domain: string;
}

export interface HsPolicy {
  policy: string;
  updated_at: string;
}
