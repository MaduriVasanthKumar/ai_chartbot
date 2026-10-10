import os
import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.db.database import get_db

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False

class DocumentService:

    @staticmethod
    def process_and_save_document(user_id: str, filename: str, file_bytes: bytes) -> Dict[str, Any]:
        doc_id = f"doc_{uuid.uuid4().hex[:10]}"
        storage_filename = f"{doc_id}_{filename}"
        storage_path = os.path.join("uploads", storage_filename)
        
        with open(storage_path, "wb") as f:
            f.write(file_bytes)
            
        extracted_text_by_page = []
        
        # Try PDF parsing if PDF
        if filename.lower().endswith(".pdf") and PYPDF_AVAILABLE:
            try:
                reader = pypdf.PdfReader(storage_path)
                for i, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    if text.strip():
                        extracted_text_by_page.append({"page": i + 1, "text": text.strip()})
            except Exception as e:
                print(f"[Document Processing Error] PDF parse error: {e}")

        # If plain text or fallback
        if not extracted_text_by_page:
            try:
                text_content = file_bytes.decode("utf-8", errors="ignore")
                extracted_text_by_page.append({"page": 1, "text": text_content.strip()})
            except Exception:
                extracted_text_by_page.append({"page": 1, "text": f"Document content for {filename}"})
                
        full_text = "\n\n".join([p["text"] for p in extracted_text_by_page])
        summary = full_text[:400] + ("..." if len(full_text) > 400 else "")
        
        now = datetime.utcnow().isoformat()
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO documents (id, user_id, filename, file_type, storage_path, processing_status, summary, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (doc_id, user_id, filename, filename.split(".")[-1], storage_path, "completed", summary, json.dumps({"page_count": len(extracted_text_by_page)}), now)
        )
        
        # Save chunks
        for idx, item in enumerate(extracted_text_by_page):
            chunk_id = f"chk_{uuid.uuid4().hex[:10]}"
            cursor.execute(
                "INSERT INTO document_chunks (id, document_id, chunk_text, page_number, chunk_index, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (chunk_id, doc_id, item["text"], item["page"], idx, "{}")
            )
            
        conn.commit()
        conn.close()
        
        return {
            "id": doc_id,
            "filename": filename,
            "page_count": len(extracted_text_by_page),
            "summary": summary,
            "created_at": now
        }

    @staticmethod
    def get_document_context(document_id: str, query: str = None) -> str:
        """Retrieves text context from the document chunks."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT page_number, chunk_text FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT 5", (document_id,))
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return ""
            
        context_parts = []
        for r in rows:
            context_parts.append(f"[Page {r['page_number']}]\n{r['chunk_text']}")
            
        return "\n\n".join(context_parts)

    @staticmethod
    def get_user_documents(user_id: str) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, filename, file_type, summary, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
