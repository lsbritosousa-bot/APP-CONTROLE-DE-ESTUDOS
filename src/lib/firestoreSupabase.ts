import { supabase } from './supabase';

export const collection = (db: any, ...pathSegments: string[]) => {
  return { type: 'collection', path: pathSegments };
};

export const doc = (db: any, ...pathSegments: string[]) => {
  return { type: 'doc', path: pathSegments };
};

export const query = (ref: any, ...clauses: any[]) => {
  return { ref, clauses };
};

export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => {
  return { type: 'orderBy', field, direction };
};

export const increment = (value: number) => {
  return { type: 'increment', value };
};

// Helper to determine table and filtering by users/user_id since Firebase path structure is:
// "users", uid, "subjects" -> table: subjects, user_id=uid
// "users", uid, "subjects", subjectId, "topics" -> table: topics, user_id=uid, subject_id=subjectId
const parsePath = (path: string[]) => {
  let table = '';
  let filters: Record<string, any> = {};

  if (path[0] === 'users') {
    if (path.length === 1) table = 'user_profiles';
    else if (path.length === 2) {
      table = 'user_profiles';
      filters['id'] = path[1];
    } else if (path.length === 3) {
      table = path[2];
      filters['user_id'] = path[1];
    } else if (path.length === 4) {
      table = path[2];
      filters['user_id'] = path[1];
      filters['id'] = path[3];
    } else if (path.length === 5) {
      table = path[4];
      filters['user_id'] = path[1];
      if (path[2] === 'subjects') filters['subject_id'] = path[3];
    } else if (path.length === 6) {
      table = path[4];
      filters['user_id'] = path[1];
      if (path[2] === 'subjects') filters['subject_id'] = path[3];
      filters['id'] = path[5];
    }
  } else {
    table = path[0];
    if (path.length > 1) filters['id'] = path[1];
  }
  return { table, filters };
};

const buildQuery = (ref: any) => {
  const isQuery = ref.clauses !== undefined;
  const target = isQuery ? ref.ref : ref;
  const { table, filters } = parsePath(target.path);

  let q = supabase.from(table).select('*');
  for (const [k, v] of Object.entries(filters)) {
    q = q.eq(k, v);
  }

  if (isQuery) {
    for (const clause of ref.clauses) {
      if (clause.type === 'orderBy') {
        const snakeField = clause.field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        q = q.order(snakeField, { ascending: clause.direction === 'asc' });
      }
    }
  }
  return { q, table, filters };
};

export const getDocs = async (ref: any) => {
  const { q } = buildQuery(ref);
  const { data } = await q;
  return {
    docs: (data || []).map(d => ({
      id: d.id,
      data: () => mapToFirebaseCamelCase(d)
    }))
  };
};

export const onSnapshot = (ref: any, callback: (snapshot: any) => void) => {
  const { q, table, filters } = buildQuery(ref);

  const fetchAndNotify = async () => {
    const { data } = await q;
    
    // For doc refs (length even) vs collection refs
    const isDoc = ref.type === 'doc' || (ref.ref && ref.ref.type === 'doc');
    const isActuallyDocPath = (ref.path && ref.path.length % 2 === 0) || (ref.ref?.path?.length % 2 === 0);

    if (isDoc || isActuallyDocPath) {
      if (data && data.length > 0) {
        callback({
          exists: () => true,
          id: data[0].id,
          data: () => mapToFirebaseCamelCase(data[0])
        });
      } else {
        callback({ exists: () => false, data: () => null });
      }
    } else {
      callback({
        docs: (data || []).map(d => ({
          id: d.id,
          data: () => mapToFirebaseCamelCase(d)
        }))
      });
    }
  };

  fetchAndNotify();

  // Create channel for realtime
  // Supabase realtime filter only supports a single equality.
  const filterEntries = Object.entries(filters);
  const filterString = filterEntries.length > 0 ? `${filterEntries[0][0]}=eq.${filterEntries[0][1]}` : undefined;

  const channel = supabase.channel(`public:${table}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table, 
      filter: filterString
    }, fetchAndNotify)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

const mapToSnakeCase = (obj: any) => {
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    // Handle increments
    if (v && typeof v === 'object' && (v as any).type === 'increment') continue; // We don't support increments via insert directly easily 
    result[snake] = v;
  }
  return result;
};

const mapToFirebaseCamelCase = (obj: any) => {
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, g => g[1].toUpperCase());
    
    // Transform dates back to strings if needed
    if (camel === 'createdAt' || camel === 'startTime' || camel === 'date' || camel === 'lastStudied') {
      result[camel] = v; // Keep as is since string ISO is fine
    } else {
      result[camel] = v;
    }
  }
  return result;
};

export const addDoc = async (ref: any, data: any) => {
  const { table, filters } = parsePath(ref.path);
  const insertData = { ...mapToSnakeCase(data), ...filters };

  const { data: inserted, error } = await supabase.from(table).insert(insertData).select().single();
  if (error) console.error("addDoc error:", error);
  return { id: inserted?.id };
};

export const updateDoc = async (ref: any, data: any) => {
  const { table, filters } = parsePath(ref.path);
  
  // Need to handle increments carefully in Supabase.
  // Actually, Supabase has an rpc or we can fetch, then increment.
  let toUpdate = mapToSnakeCase(data);
  let increments: any = {};
  
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && (v as any).type === 'increment') {
      const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      increments[snake] = (v as any).value;
      delete toUpdate[snake];
    }
  }

  let finalUpdate = { ...toUpdate };

  if (Object.keys(increments).length > 0) {
    // Hack: fetch, increment in TS, then update.
    const { data: existing } = await supabase.from(table).select('*').match(filters).single();
    if (existing) {
      for (const [k, v] of Object.entries(increments)) {
        finalUpdate[k] = (existing[k] || 0) + (v as number);
      }
    }
  }

  const { error } = await supabase.from(table).update(finalUpdate).match(filters);
  if (error) console.error("updateDoc error:", error);
};

export const deleteDoc = async (ref: any) => {
  const { table, filters } = parsePath(ref.path);
  const { error } = await supabase.from(table).delete().match(filters);
  if (error) console.error("deleteDoc error:", error);
};
