import { initDB } from '.';

async function resetDB() {
  // Clear IndexedDB database
  const request = indexedDB.deleteDatabase('agent-view-db');
  
  request.onsuccess = async () => {
    console.log('Database deleted successfully');
    // Reinitialize the database
    await initDB();
    console.log('Database reinitialized successfully');
  };
  
  request.onerror = () => {
    console.error('Error deleting database');
  };
}

resetDB().catch(console.error); 