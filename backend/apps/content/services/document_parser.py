from io import BytesIO
import docx
from pypdf import PdfReader


def extract_text_from_file(file):
    name = file.name.lower()

    if name.endswith(".txt"):
        file.seek(0)
        return file.read().decode("utf-8", errors="ignore")

    if name.endswith(".docx"):
        file.seek(0)
        doc = docx.Document(file)
        return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

    if name.endswith(".pdf"):
        file.seek(0)
        pdf_bytes = file.read()
        reader = PdfReader(BytesIO(pdf_bytes))
        texts = []

        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                texts.append(page_text)

        return "\n".join(texts)

    return ""