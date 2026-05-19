export interface HsUser {
  id: string;
  name: string;
  created_at: string;
}

export interface HsNode {
  id: string;
  name: string;
  given_name: string;
  user: HsUser;
  last_seen: string;        // RFC3339
  expiry: string;           // RFC3339
  ip_addresses: string[];
  register_method: string;
  valid_tags: string[];
  invalid_tags: string[];
  forced_tags: string[];
  created_at: string;
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
  created_at: string;
  acl_tags: string[];
}

export interface HsRoute {
  id: string;
  node: HsNode;
  prefix: string;
  advertised: boolean;
  enabled: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface HsApiKey {
  id: string;
  prefix: string;
  expiration: string;
  created_at: string;
  last_seen_at?: string;
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
