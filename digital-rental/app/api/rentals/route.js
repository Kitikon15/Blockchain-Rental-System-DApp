import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'rentals-state.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          rentals: [],
          statusOverrides: {},
          timeOverrides: {},
          cancelOverrides: {},
        },
        null,
        2
      )
    );
  }
}

function readState() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading rentals state:', err);
    return {
      rentals: [],
      statusOverrides: {},
      timeOverrides: {},
      cancelOverrides: {},
    };
  }
}

function writeState(state) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing rentals state:', err);
  }
}

export async function GET() {
  const state = readState();
  return NextResponse.json(
    {
      success: true,
      ...state,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, rental, rentalId, status, extraData, state: incomingState } = body;

    const state = readState();

    if (action === 'save_rental' && rental) {
      const id = Number(rental.rentalId);
      const filtered = (state.rentals || []).filter((r) => Number(r.rentalId) !== id);
      state.rentals = [rental, ...filtered];
      writeState(state);
      return NextResponse.json({ success: true, state });
    }

    if (action === 'approve') {
      const id = Number(rentalId);
      const now = Math.floor(Date.now() / 1000);
      const startTime = extraData?.startTime || now;
      const endTime = extraData?.endTime || now + 86400;

      // 1. Update dynamic rentals array if present
      let found = false;
      state.rentals = (state.rentals || []).map((r) => {
        if (Number(r.rentalId) === id) {
          found = true;
          return {
            ...r,
            status: 2, // ACTIVE
            startTime,
            endTime,
            ...extraData,
          };
        }
        return r;
      });

      if (!found && extraData) {
        state.rentals = state.rentals || [];
        state.rentals.push({
          rentalId: id,
          status: 2,
          startTime,
          endTime,
          ...extraData,
        });
      }

      // 2. Always set status override and time override for cross-client sync (both number and string keys)
      state.statusOverrides = state.statusOverrides || {};
      state.statusOverrides[id] = 2; // ACTIVE
      state.statusOverrides[String(id)] = 2;

      state.timeOverrides = state.timeOverrides || {};
      state.timeOverrides[id] = {
        ...(state.timeOverrides[id] || {}),
        startTime,
        endTime,
      };
      state.timeOverrides[String(id)] = state.timeOverrides[id];

      writeState(state);
      return NextResponse.json({ success: true, state });
    }

    if (action === 'update_status') {
      const id = Number(rentalId);
      const newStatus = Number(status);

      let found = false;
      state.rentals = (state.rentals || []).map((r) => {
        if (Number(r.rentalId) === id) {
          found = true;
          return {
            ...r,
            status: newStatus,
            ...(extraData || {}),
          };
        }
        return r;
      });

      if (!found && extraData) {
        state.rentals = state.rentals || [];
        state.rentals.push({
          rentalId: id,
          status: newStatus,
          ...extraData,
        });
      }

      state.statusOverrides = state.statusOverrides || {};
      state.statusOverrides[id] = newStatus;
      state.statusOverrides[String(id)] = newStatus;

      if (extraData && Object.keys(extraData).length > 0) {
        state.cancelOverrides = state.cancelOverrides || {};
        state.cancelOverrides[id] = {
          ...(state.cancelOverrides[id] || {}),
          ...extraData,
        };
        state.cancelOverrides[String(id)] = state.cancelOverrides[id];
      }

      writeState(state);
      return NextResponse.json({ success: true, state });
    }

    if (action === 'sync' && incomingState) {
      // Merge client state into server state
      if (Array.isArray(incomingState.rentals)) {
        const existingIds = new Set((state.rentals || []).map((r) => Number(r.rentalId)));
        incomingState.rentals.forEach((r) => {
          if (!existingIds.has(Number(r.rentalId))) {
            state.rentals.push(r);
          }
        });
      }

      state.statusOverrides = {
        ...(state.statusOverrides || {}),
        ...(incomingState.statusOverrides || {}),
      };

      state.timeOverrides = {
        ...(state.timeOverrides || {}),
        ...(incomingState.timeOverrides || {}),
      };

      state.cancelOverrides = {
        ...(state.cancelOverrides || {}),
        ...(incomingState.cancelOverrides || {}),
      };

      writeState(state);
      return NextResponse.json({ success: true, state });
    }

    writeState(state);
    return NextResponse.json({ success: true, state });
  } catch (err) {
    console.error('Error in /api/rentals POST:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
