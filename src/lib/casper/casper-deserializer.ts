/**
 * Manual deserializer for Casper CLType::Any structures
 * Implements the FromBytes logic from Rust contract
 */

/**
 * Helper to convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Read u32 (little-endian, 4 bytes)
 */
function readU32(bytes: Uint8Array, offset: number): { value: number; offset: number } {
  const value = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
  return { value: value >>> 0, offset: offset + 4 }; // >>> 0 converts to unsigned
}

/**
 * Read u64 (little-endian, 8 bytes)
 */
function readU64(bytes: Uint8Array, offset: number): { value: bigint; offset: number } {
  let value = BigInt(0);
  for (let i = 0; i < 8; i++) {
    value |= BigInt(bytes[offset + i]) << BigInt(i * 8);
  }
  return { value, offset: offset + 8 };
}

/**
 * Read bool (1 byte)
 */
function readBool(bytes: Uint8Array, offset: number): { value: boolean; offset: number } {
  return { value: bytes[offset] !== 0, offset: offset + 1 };
}

/**
 * Read String (4 bytes length + UTF-8 bytes)
 */
function readString(bytes: Uint8Array, offset: number): { value: string; offset: number } {
  const { value: length, offset: lenOffset } = readU32(bytes, offset);
  const strBytes = bytes.slice(lenOffset, lenOffset + length);
  const value = new TextDecoder().decode(strBytes);
  return { value, offset: lenOffset + length };
}

/**
 * Read U256 (32 bytes, little-endian)
 */
function readU256(bytes: Uint8Array, offset: number): { value: bigint; offset: number } {
  let value = BigInt(0);
  for (let i = 0; i < 32; i++) {
    value |= BigInt(bytes[offset + i]) << BigInt(i * 8);
  }
  return { value, offset: offset + 32 };
}

/**
 * Read Key (1 byte tag + 32 bytes for AccountHash or Hash)
 * Key variants:
 * - 0x00: Account (33 bytes total: 1 tag + 32 bytes account hash)
 * - 0x01: Hash (33 bytes total: 1 tag + 32 bytes hash)
 * - 0x02: URef (33 bytes total: 1 tag + 32 bytes URef)
 */
function readKey(bytes: Uint8Array, offset: number): { value: string; offset: number } {
  const tag = bytes[offset];
  offset++;
  
  if (tag === 0x00) {
    // Account (AccountHash) - 32 bytes
    const keyBytes = bytes.slice(offset, offset + 32);
    const hex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    // Return in format that matches Casper key format (hex without prefix for now)
    return { value: hex, offset: offset + 32 };
  } else if (tag === 0x01) {
    // Hash - 32 bytes
    const keyBytes = bytes.slice(offset, offset + 32);
    const hex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return { value: `hash-${hex}`, offset: offset + 32 };
  } else if (tag === 0x02) {
    // URef - 32 bytes (we'll return as hex)
    const keyBytes = bytes.slice(offset, offset + 32);
    const hex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return { value: `uref-${hex}`, offset: offset + 32 };
  } else {
    throw new Error(`Unsupported Key tag: 0x${tag.toString(16)}`);
  }
}

/**
 * Read Option<T> where T is Key (1 byte Some/None + Key if Some)
 */
function readOptionKey(bytes: Uint8Array, offset: number): { value: string | null; offset: number } {
  if (offset >= bytes.length) {
    throw new Error(`Cannot read Option<Key> tag: offset ${offset} >= bytes.length ${bytes.length}`);
  }
  
  const tag = bytes[offset];
  offset++;
  
  if (tag === 0x00) {
    // None
    return { value: null, offset };
  } else if (tag === 0x01) {
    // Some - read Key
    try {
      const { value, offset: newOffset } = readKey(bytes, offset);
      return { value, offset: newOffset };
    } catch (e) {
      console.warn(`[casper-deserializer] Failed to read Key in Option<Key> at offset ${offset}, treating as None:`, e);
      // Skip 33 bytes (Key size: 1 byte tag + 32 bytes)
      return { value: null, offset: offset + 32 };
    }
  } else {
    // Invalid tag - might be misaligned
    console.warn(`[casper-deserializer] Unexpected Option<Key> tag: ${tag} (0x${tag.toString(16)}) at offset ${offset - 1}, treating as None`);
    // Return None and skip 33 bytes (Key size) to try to recover
    return { value: null, offset: offset + 32 }; // +32 because we already incremented offset
  }
}

/**
 * Read Vec<T> where T is Key (4 bytes length + items)
 */
function readVecKey(bytes: Uint8Array, offset: number): { value: string[]; offset: number } {
  const { value: length, offset: lenOffset } = readU32(bytes, offset);
  const items: string[] = [];
  let currentOffset = lenOffset;
  
  for (let i = 0; i < length; i++) {
    const { value, offset: newOffset } = readKey(bytes, currentOffset);
    items.push(value);
    currentOffset = newOffset;
  }
  
  return { value: items, offset: currentOffset };
}

/**
 * Read Option<u64> (1 byte Some/None + u64 if Some)
 */
function readOptionU64(bytes: Uint8Array, offset: number): { value: bigint | null; offset: number } {
  if (offset >= bytes.length) {
    throw new Error(`Cannot read Option<u64> tag: offset ${offset} >= bytes.length ${bytes.length}`);
  }
  
  const tag = bytes[offset];
  offset++;
  
  if (tag === 0x00) {
    // None
    return { value: null, offset };
  } else if (tag === 0x01) {
    // Some - read u64
    if (offset + 8 > bytes.length) {
      throw new Error(`Cannot read u64: offset ${offset} + 8 > bytes.length ${bytes.length}`);
    }
    const { value, offset: newOffset } = readU64(bytes, offset);
    return { value, offset: newOffset };
  } else {
    // Invalid tag - might be misaligned, try to continue
    console.warn(`[casper-deserializer] Unexpected Option<u64> tag: ${tag} (0x${tag.toString(16)}) at offset ${offset - 1}, treating as None`);
    // Return None and skip 8 bytes (size of u64) to try to recover
    return { value: null, offset: offset + 7 }; // +7 because we already incremented offset
  }
}

/**
 * Read Milestone
 */
function readMilestone(bytes: Uint8Array, offset: number): { value: any; offset: number } {
  try {
    const { value: description, offset: descOffset } = readString(bytes, offset);
    
    if (descOffset + 32 > bytes.length) {
      throw new Error(`Cannot read U256: descOffset ${descOffset} + 32 > bytes.length ${bytes.length}`);
    }
    const { value: amount, offset: amountOffset } = readU256(bytes, descOffset);
    
    // Read status (u8, 1 byte) - MilestoneStatus enum (0-5)
    if (amountOffset >= bytes.length) {
      throw new Error(`Cannot read status: amountOffset ${amountOffset} >= bytes.length ${bytes.length}`);
    }
    const status = bytes[amountOffset];
    const statusOffset = amountOffset + 1;
    
    // Read approved_at (Option<u64>)
    const { value: approved_at, offset: approvedOffset } = readOptionU64(bytes, statusOffset);
    
    return {
      value: {
        description,
        amount: amount.toString(),
        status,
        approved_at: approved_at ? Number(approved_at) : null,
      },
      offset: approvedOffset
    };
  } catch (error) {
    console.error(`[casper-deserializer] Error reading Milestone at offset ${offset}:`, error);
    throw error;
  }
}

/**
 * Read Vec<Milestone>
 */
function readVecMilestone(bytes: Uint8Array, offset: number): { value: any[]; offset: number } {
  const { value: length, offset: lenOffset } = readU32(bytes, offset);
  const items: any[] = [];
  let currentOffset = lenOffset;
  
  for (let i = 0; i < length; i++) {
    const { value, offset: newOffset } = readMilestone(bytes, currentOffset);
    items.push(value);
    currentOffset = newOffset;
  }
  
  return { value: items, offset: currentOffset };
}

/**
 * Deserialize Escrow from bytes
 */
export function deserializeEscrow(hexBytes: string): any {
  const bytes = hexToBytes(hexBytes);
  let offset = 0;
  
  // id: u32
  const { value: id, offset: idOffset } = readU32(bytes, offset);
  offset = idOffset;
  
  // depositor: Key
  const { value: depositor, offset: depositorOffset } = readKey(bytes, offset);
  offset = depositorOffset;
  
  // beneficiary: Option<Key>
  const { value: beneficiary, offset: beneficiaryOffset } = readOptionKey(bytes, offset);
  offset = beneficiaryOffset;
  
  // arbiters: Vec<Key>
  const { value: arbiters, offset: arbitersOffset } = readVecKey(bytes, offset);
  offset = arbitersOffset;
  
  // required_confirmations: u32
  const { value: required_confirmations, offset: reqConfOffset } = readU32(bytes, offset);
  offset = reqConfOffset;
  
  // milestones: Vec<Milestone>
  const { value: milestones, offset: milestonesOffset } = readVecMilestone(bytes, offset);
  offset = milestonesOffset;
  
  // token: Option<Key>
  const { value: token, offset: tokenOffset } = readOptionKey(bytes, offset);
  offset = tokenOffset;
  
  // total_amount: U256
  const { value: total_amount, offset: totalAmountOffset } = readU256(bytes, offset);
  offset = totalAmountOffset;
  
  // platform_fee: U256
  const { value: platform_fee, offset: platformFeeOffset } = readU256(bytes, offset);
  offset = platformFeeOffset;
  
  // status: EscrowStatus (u8)
  const status = bytes[offset];
  offset++;
  
  // created_at: u64
  const { value: created_at, offset: createdAtOffset } = readU64(bytes, offset);
  offset = createdAtOffset;
  
  // deadline: u64
  const { value: deadline, offset: deadlineOffset } = readU64(bytes, offset);
  offset = deadlineOffset;
  
  // project_title: String
  const { value: project_title, offset: titleOffset } = readString(bytes, offset);
  offset = titleOffset;
  
  // project_description: String
  const { value: project_description, offset: descOffset } = readString(bytes, offset);
  offset = descOffset;
  
  // is_open_job: bool
  const { value: is_open_job, offset: isOpenJobOffset } = readBool(bytes, offset);
  offset = isOpenJobOffset;
  
  // dispute_resolver: Option<Key>
  let dispute_resolver: string | null = null;
  try {
    const result = readOptionKey(bytes, offset);
    dispute_resolver = result.value;
    offset = result.offset;
  } catch (e) {
    console.warn(`[casper-deserializer] Failed to read dispute_resolver, treating as None:`, e);
    // Try to skip forward (33 bytes for Option<Key>: 1 tag + 32 bytes for Key)
    offset = offset + 33;
  }
  
  return {
    id,
    depositor,
    beneficiary,
    arbiters,
    required_confirmations,
    milestones,
    token,
    total_amount: total_amount.toString(),
    platform_fee: platform_fee.toString(),
    status,
    created_at: Number(created_at),
    deadline: Number(deadline),
    project_title,
    project_description,
    is_open_job,
    dispute_resolver
  };
}
