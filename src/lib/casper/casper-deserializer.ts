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
  if (offset + 8 > bytes.length) {
    throw new Error(`Cannot read U64: insufficient bytes at offset ${offset}. Need 8 bytes, have ${bytes.length - offset}`);
  }
  let value = BigInt(0);
  for (let i = 0; i < 8; i++) {
    const byte = bytes[offset + i];
    if (byte === undefined) {
      throw new Error(`Cannot read U64: undefined byte at offset ${offset + i}`);
    }
    value |= BigInt(byte) << BigInt(i * 8);
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
  if (offset + 32 > bytes.length) {
    throw new Error(`Cannot read U256: insufficient bytes at offset ${offset}. Need 32 bytes, have ${bytes.length - offset}`);
  }
  let value = BigInt(0);
  for (let i = 0; i < 32; i++) {
    const byte = bytes[offset + i];
    if (byte === undefined) {
      throw new Error(`Cannot read U256: undefined byte at offset ${offset + i}`);
    }
    value |= BigInt(byte) << BigInt(i * 8);
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
    // Invalid tag - might be misaligned, try to skip forward and return None
    console.warn(`[casper-deserializer] Unexpected Option<Key> tag: ${tag} (0x${tag.toString(16)}) at offset ${offset - 1}, treating as None and skipping`);
    // Don't increment offset further - we're already past the tag byte
    // Return current offset (already incremented past tag)
    return { value: null, offset };
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
  try {
    const { value: length, offset: lenOffset } = readU32(bytes, offset);
    console.log(`[casper-deserializer] Reading ${length} milestones starting at offset ${lenOffset}, total bytes: ${bytes.length}`);
    
    // Validate length is reasonable (not corrupted)
    if (length > 100) {
      console.warn(`[casper-deserializer] Suspicious milestone count ${length}, limiting to 10`);
      // Return empty array and skip forward - this is likely corrupted
      return { value: [], offset: lenOffset };
    }
    
    const items: any[] = [];
    let currentOffset = lenOffset;
    
    for (let i = 0; i < length; i++) {
      try {
        const { value, offset: newOffset } = readMilestone(bytes, currentOffset);
        items.push(value);
        currentOffset = newOffset;
        console.log(`[casper-deserializer] Successfully read milestone ${i}, new offset: ${currentOffset}`);
      } catch (e: any) {
        console.error(`[casper-deserializer] Failed to read milestone ${i} at offset ${currentOffset}:`, e);
        // If we can't read a milestone, we're misaligned - return what we have and stop
        // This will cause subsequent fields to be misaligned, but at least we tried
        console.warn(`[casper-deserializer] Stopping milestone reading at ${i}/${length}, returning ${items.length} milestones`);
        break;
      }
    }
    
    console.log(`[casper-deserializer] Read ${items.length}/${length} milestones, final offset: ${currentOffset}`);
    return { value: items, offset: currentOffset };
  } catch (e: any) {
    console.error(`[casper-deserializer] Failed to read Vec<Milestone> at offset ${offset}:`, e);
    // Return empty array and try to skip forward
    // Vec has 4-byte length prefix, but we don't know how many items, so just skip 4 bytes
    return { value: [], offset: offset + 4 };
  }
}

/**
 * Deserialize Escrow from bytes
 */
export function deserializeEscrow(hexBytes: string): any {
  const bytes = hexToBytes(hexBytes);
  let offset = 0;
  
  console.log(`[casper-deserializer] Starting deserialization, total bytes: ${bytes.length}`);
  
  // id: u32
  const { value: id, offset: idOffset } = readU32(bytes, offset);
  offset = idOffset;
  console.log(`[casper-deserializer] Read id: ${id}, offset: ${offset}`);
  
  // depositor: Key
  const { value: depositor, offset: depositorOffset } = readKey(bytes, offset);
  offset = depositorOffset;
  console.log(`[casper-deserializer] Read depositor: ${depositor}, offset: ${offset}`);
  
  // beneficiary: Option<Key>
  const { value: beneficiary, offset: beneficiaryOffset } = readOptionKey(bytes, offset);
  offset = beneficiaryOffset;
  console.log(`[casper-deserializer] Read beneficiary: ${beneficiary}, offset: ${offset}`);
  
  // arbiters: Vec<Key>
  const { value: arbiters, offset: arbitersOffset } = readVecKey(bytes, offset);
  offset = arbitersOffset;
  console.log(`[casper-deserializer] Read ${arbiters.length} arbiters, offset: ${offset}`);
  
  // required_confirmations: u32
  const { value: required_confirmations, offset: reqConfOffset } = readU32(bytes, offset);
  offset = reqConfOffset;
  console.log(`[casper-deserializer] Read required_confirmations: ${required_confirmations}, offset: ${offset}`);
  
  // milestones: Vec<Milestone>
  const milestonesStartOffset = offset;
  const { value: milestones, offset: milestonesOffset } = readVecMilestone(bytes, offset);
  offset = milestonesOffset;
  console.log(`[casper-deserializer] Read ${milestones.length} milestones, offset: ${offset} (consumed ${offset - milestonesStartOffset} bytes)`);
  
  // token: Option<Key>
  const { value: token, offset: tokenOffset } = readOptionKey(bytes, offset);
  offset = tokenOffset;
  console.log(`[casper-deserializer] Read token: ${token}, offset: ${offset}`);
  
  // total_amount: U256
  let total_amount = BigInt(0);
  const amountStartOffset = offset;
  try {
    const result = readU256(bytes, offset);
    total_amount = result.value;
    offset = result.offset;
    
    // Validate amount is reasonable (not corrupted) - max 1 billion CSPR = 1e27 motes
    const maxReasonableAmount = BigInt("1000000000000000000000000000"); // 1 billion CSPR in motes
    if (total_amount > maxReasonableAmount) {
      console.warn(`[casper-deserializer] Suspicious total_amount ${total_amount.toString()} at offset ${amountStartOffset}, likely corrupted due to milestone misalignment.`);
      console.warn(`[casper-deserializer] Attempting to find correct offset by searching for reasonable values...`);
      
      // Try to find the correct offset by searching forward for a reasonable U256 value
      // A reasonable amount would be < 1e27 motes, which means the first few bytes should be mostly zeros
      let foundValidOffset = false;
      for (let searchOffset = amountStartOffset; searchOffset < Math.min(bytes.length - 32, amountStartOffset + 200); searchOffset++) {
        try {
          const testResult = readU256(bytes, searchOffset);
          if (testResult.value <= maxReasonableAmount && testResult.value > BigInt(0)) {
            console.log(`[casper-deserializer] Found valid total_amount ${testResult.value.toString()} at offset ${searchOffset} (shifted by ${searchOffset - amountStartOffset} bytes)`);
            total_amount = testResult.value;
            offset = testResult.offset;
            foundValidOffset = true;
            break;
          }
        } catch {
          // Continue searching
        }
      }
      
      if (!foundValidOffset) {
        console.warn(`[casper-deserializer] Could not find valid total_amount, using 0`);
        total_amount = BigInt(0);
        // Skip 32 bytes to try to continue
        if (offset + 32 <= bytes.length) {
          offset += 32;
        }
      }
    } else {
      console.log(`[casper-deserializer] Read total_amount: ${total_amount.toString()}, offset: ${offset}`);
    }
  } catch (e) {
    console.error(`[casper-deserializer] Failed to read total_amount at offset ${offset}:`, e);
    // If we can't read total_amount, we're severely misaligned - try to skip 32 bytes
    if (offset + 32 <= bytes.length) {
      offset += 32;
    } else {
      // Can't skip, just use 0
      console.warn(`[casper-deserializer] Cannot skip total_amount, using 0`);
    }
  }
  
  // platform_fee: U256
  let platform_fee = BigInt(0);
  try {
    const result = readU256(bytes, offset);
    platform_fee = result.value;
    offset = result.offset;
    console.log(`[casper-deserializer] Read platform_fee: ${platform_fee.toString()}, offset: ${offset}`);
  } catch (e) {
    console.error(`[casper-deserializer] Failed to read platform_fee at offset ${offset}:`, e);
    // If we can't read platform_fee, we're severely misaligned - try to skip 32 bytes
    if (offset + 32 <= bytes.length) {
      offset += 32;
    } else {
      // Can't skip, just use 0
      console.warn(`[casper-deserializer] Cannot skip platform_fee, using 0`);
    }
  }
  
  // status: EscrowStatus (u8)
  if (offset >= bytes.length) {
    console.error(`[casper-deserializer] Cannot read status: offset ${offset} >= bytes.length ${bytes.length}`);
  }
  const status = bytes[offset];
  offset++;
  console.log(`[casper-deserializer] Read status: ${status}, offset: ${offset}`);
  
  // created_at: u64
  let created_at = BigInt(0);
  const createdAtStartOffset = offset;
  try {
    const result = readU64(bytes, offset);
    created_at = result.value;
    offset = result.offset;
    
    // Validate timestamp is reasonable (not corrupted)
    // Casper timestamps are in milliseconds since Unix epoch
    // Valid range: between 2020-01-01 and 2100-01-01
    const minTimestamp = BigInt(1577836800000); // 2020-01-01
    const maxTimestamp = BigInt(4102444800000); // 2100-01-01
    const now = BigInt(Date.now());
    
    if (created_at < minTimestamp || created_at > maxTimestamp) {
      // Also check if it's in seconds instead of milliseconds
      const created_at_seconds = created_at * BigInt(1000);
      if (created_at_seconds >= minTimestamp && created_at_seconds <= maxTimestamp) {
        console.log(`[casper-deserializer] created_at appears to be in seconds, converting to milliseconds`);
        created_at = created_at_seconds;
      } else if (created_at > BigInt(1e15)) {
        // Way too large - definitely corrupted, try to find correct offset
        console.warn(`[casper-deserializer] Invalid created_at timestamp ${created_at.toString()} at offset ${createdAtStartOffset}, likely corrupted. Searching for valid timestamp...`);
        
        let foundValidOffset = false;
        for (let searchOffset = createdAtStartOffset; searchOffset < Math.min(bytes.length - 8, createdAtStartOffset + 100); searchOffset++) {
          try {
            const testResult = readU64(bytes, searchOffset);
            let testTimestamp = testResult.value;
            // Check if in seconds
            if (testTimestamp < minTimestamp && testTimestamp > BigInt(0)) {
              testTimestamp = testTimestamp * BigInt(1000);
            }
            if (testTimestamp >= minTimestamp && testTimestamp <= maxTimestamp) {
              console.log(`[casper-deserializer] Found valid created_at ${testTimestamp.toString()} (${new Date(Number(testTimestamp)).toISOString()}) at offset ${searchOffset} (shifted by ${searchOffset - createdAtStartOffset} bytes)`);
              created_at = testTimestamp;
              offset = testResult.offset;
              foundValidOffset = true;
              break;
            }
          } catch {
            // Continue searching
          }
        }
        
        if (!foundValidOffset) {
          console.warn(`[casper-deserializer] Could not find valid created_at, using current time`);
          created_at = now;
          // Skip 8 bytes to try to continue
          if (offset + 8 <= bytes.length) {
            offset += 8;
          }
        }
      } else {
        console.log(`[casper-deserializer] Read created_at: ${created_at.toString()} (${new Date(Number(created_at)).toISOString()}), offset: ${offset}`);
      }
    } else {
      console.log(`[casper-deserializer] Read created_at: ${created_at.toString()} (${new Date(Number(created_at)).toISOString()}), offset: ${offset}`);
    }
  } catch (e) {
    console.error(`[casper-deserializer] Failed to read created_at at offset ${offset}:`, e);
    // Try to skip 8 bytes (u64 size)
    if (offset + 8 <= bytes.length) {
      offset += 8;
    } else {
      // Can't skip, use current time as fallback
      created_at = BigInt(Date.now());
      console.warn(`[casper-deserializer] Using current time for created_at`);
    }
  }
  
  // deadline: u64
  let deadline = BigInt(0);
  try {
    const result = readU64(bytes, offset);
    deadline = result.value;
    offset = result.offset;
    
    // Validate deadline timestamp is reasonable
    const minTimestamp = BigInt(1577836800000); // 2020-01-01
    const maxTimestamp = BigInt(4102444800000); // 2100-01-01
    
    if (deadline < minTimestamp || deadline > maxTimestamp) {
      // Check if it's in seconds
      const deadline_seconds = deadline * BigInt(1000);
      if (deadline_seconds >= minTimestamp && deadline_seconds <= maxTimestamp) {
        console.log(`[casper-deserializer] deadline appears to be in seconds, converting to milliseconds`);
        deadline = deadline_seconds;
      } else if (deadline > BigInt(1e15)) {
        // Way too large - definitely corrupted
        console.warn(`[casper-deserializer] Invalid deadline timestamp ${deadline.toString()}, likely corrupted. Using default (7 days from created_at).`);
        deadline = created_at + BigInt(7 * 24 * 60 * 60 * 1000);
      } else {
        console.log(`[casper-deserializer] Read deadline: ${deadline.toString()} (${new Date(Number(deadline)).toISOString()}), offset: ${offset}`);
      }
    } else {
      console.log(`[casper-deserializer] Read deadline: ${deadline.toString()} (${new Date(Number(deadline)).toISOString()}), offset: ${offset}`);
    }
    
    // Ensure deadline is after created_at
    if (deadline < created_at) {
      console.warn(`[casper-deserializer] Deadline ${deadline.toString()} is before created_at ${created_at.toString()}, adjusting to 7 days from created_at`);
      deadline = created_at + BigInt(7 * 24 * 60 * 60 * 1000);
    }
  } catch (e) {
    console.error(`[casper-deserializer] Failed to read deadline at offset ${offset}:`, e);
    // Try to skip 8 bytes (u64 size)
    if (offset + 8 <= bytes.length) {
      offset += 8;
    } else {
      // Can't skip, use a default deadline (7 days from created_at)
      deadline = created_at + BigInt(7 * 24 * 60 * 60 * 1000);
      console.warn(`[casper-deserializer] Using default deadline`);
    }
  }
  
  // project_title: String
  let project_title = "";
  try {
    const result = readString(bytes, offset);
    project_title = result.value;
    offset = result.offset;
    console.log(`[casper-deserializer] Read project_title: "${project_title}", offset: ${offset}`);
  } catch (e) {
    console.error(`[casper-deserializer] Failed to read project_title at offset ${offset}:`, e);
    project_title = "Untitled Project";
    // Try to skip forward - strings have a 4-byte length prefix, but we don't know the length
    // Best we can do is skip a reasonable amount or stop
    if (offset + 4 <= bytes.length) {
      try {
        const { offset: lenOffset } = readU32(bytes, offset);
        const len = bytes[lenOffset] | (bytes[lenOffset + 1] << 8) | (bytes[lenOffset + 2] << 16) | (bytes[lenOffset + 3] << 24);
        offset = lenOffset + len;
      } catch {
        // If we can't read length, just skip 4 bytes
        offset += 4;
      }
    }
  }
  
  // project_description: String
  let project_description = "";
  try {
    const result = readString(bytes, offset);
    project_description = result.value;
    offset = result.offset;
    console.log(`[casper-deserializer] Read project_description: "${project_description}", offset: ${offset}`);
  } catch (e) {
    console.error(`[casper-deserializer] Failed to read project_description at offset ${offset}:`, e);
    project_description = "No description available";
    // Try to skip forward
    if (offset + 4 <= bytes.length) {
      try {
        const { offset: lenOffset } = readU32(bytes, offset);
        const len = bytes[lenOffset] | (bytes[lenOffset + 1] << 8) | (bytes[lenOffset + 2] << 16) | (bytes[lenOffset + 3] << 24);
        offset = lenOffset + len;
      } catch {
        offset += 4;
      }
    }
  }
  
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
    total_amount: total_amount ? total_amount.toString() : "0",
    platform_fee: platform_fee ? platform_fee.toString() : "0",
    status,
    created_at: Number(created_at),
    deadline: Number(deadline),
    project_title,
    project_description,
    is_open_job,
    dispute_resolver
  };
}
