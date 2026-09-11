from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

out = 'scripts/fixtures/contatti-complex-multipage.pdf'
c = canvas.Canvas(out, pagesize=A4)
width, height = A4
rows = [
    ('Nome', 'Cognome', 'Email', 'Telefono', 'Note'),
    ('Anna', 'Bianchi', 'anna.pdf01@example.com', '+393330001001', 'Pagina 1 - richiesta demo'),
    ('Paolo', 'Verdi', 'paolo.pdf02@example.com', '+393330001002', 'Pagina 1 - follow up'),
    ('Sara', 'Neri', 'sara.pdf03@example.com', '+393330001003', 'Pagina 1 - documento complesso'),
]
for page in range(2):
    c.setFont('Helvetica-Bold', 14)
    c.drawString(20 * mm, height - 20 * mm, f'Rubrica clienti - sezione {page + 1}')
    c.setFont('Helvetica', 9)
    y = height - 38 * mm
    source = rows if page == 0 else [
        ('Nome', 'Cognome', 'Email', 'Telefono', 'Note'),
        ('Luca', 'Gialli', 'luca.pdf04@example.com', '+393330001004', 'Pagina 2 - riga multipagina'),
        ('Marta', 'Rossi', 'marta.pdf05@example.com', '+393330001005', 'Pagina 2 - campo note esteso'),
        ('Elena', 'Blu', 'elena.pdf06@example.com', '+393330001006', 'Pagina 2 - chiusura import'),
    ]
    for row in source:
        line = ';'.join(row)
        c.drawString(20 * mm, y, line)
        y -= 9 * mm
    c.setFont('Helvetica-Oblique', 8)
    c.drawString(20 * mm, 20 * mm, 'Fixture QA ProntoAI24 - non contiene dati reali')
    c.showPage()
c.save()
print(out)
