import sqlite3
import os
import sys
from datasets import load_dataset
from tqdm import tqdm



# Get the path to your bookhaven.db file
# This script should be in the scripts folder, so we need to go up one level
db_path = os.path.join(os.path.dirname(__file__), '..', 'bookhaven.db')
print(f" Database will be saved to: {db_path}")

# Check if database already exists
if os.path.exists(db_path):
    print(" Database already exists!")
    response = input("Do you want to overwrite it? (y/n): ")
    if response.lower() != 'y':
        print(" Exiting...")
        sys.exit(0)

print("\n Loading Goodreads dataset from Hugging Face...")
print("   (This may take 10-20 minutes on first run as it downloads ~2GB of data)")

# Load the dataset
try:
    ds = load_dataset("BrightData/Goodreads-Books")
    print(f" Dataset loaded successfully!")
    print(f"   Total books: {len(ds['train']):,}")
except Exception as e:
    print(f" Failed to load dataset: {e}")
    print("   Make sure you have internet connection and enough disk space (~3GB)")
    sys.exit(1)

# Connect to SQLite database
print("\n💾 Connecting to SQLite database...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create the table
print(" Creating table structure...")
cursor.execute('''
CREATE TABLE IF NOT EXISTS goodreads_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    author TEXT,
    star_rating REAL,
    num_ratings INTEGER,
    num_reviews INTEGER,
    summary TEXT,
    genres TEXT,
    first_published TEXT,
    goodreads_url TEXT
)
''')

# Create indexes for fast search
print(" Creating indexes for fast search...")
cursor.execute('CREATE INDEX IF NOT EXISTS idx_title ON goodreads_books(title)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_author ON goodreads_books(author)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_genres ON goodreads_books(genres)')

# Insert data in batches
print("\n📥 Inserting books into database...")
print("   This may take 5-10 minutes...")

batch_size = 5000
total = len(ds['train'])
inserted = 0

# Progress bar
with tqdm(total=total, desc="Importing books", unit="books") as pbar:
    for i in range(0, total, batch_size):
        batch = ds['train'][i:i+batch_size]
        
        for item in batch:
            try:
                cursor.execute('''
                INSERT OR REPLACE INTO goodreads_books 
                (title, author, star_rating, num_ratings, num_reviews, summary, genres, first_published, goodreads_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    item.get('title', '')[:500] if item.get('title') else None,
                    item.get('author', '')[:200] if item.get('author') else None,
                    float(item.get('star_rating', 0)) if item.get('star_rating') else None,
                    int(item.get('num_ratings', 0)) if item.get('num_ratings') else None,
                    int(item.get('num_reviews', 0)) if item.get('num_reviews') else None,
                    item.get('summary', '')[:5000] if item.get('summary') else None,
                    item.get('genres', '')[:500] if item.get('genres') else None,
                    item.get('first_published', '')[:50] if item.get('first_published') else None,
                    item.get('url', '')[:500] if item.get('url') else None
                ))
                inserted += 1
            except Exception as e:
                print(f"\n  Error inserting book: {e}")
                continue
        
        conn.commit()
        pbar.update(len(batch))


conn.close()
