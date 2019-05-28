---
layout: post
title: Bilder mit exiftool sortieren
---

# Familienfotos immer am richtigen Ort

[test](/fuuuubar/test.html)

Bisher habe ich unsere Fotos von Hand in folgende Ordnerstruktur einsortiert: `Jahr/Monat/Tag/Bildname-Nummer.format`

Mit der Zeit wird sowas aber anstrengend und Fehleranfaellig. Darum habe ich mir ein Script geschrieben welches per cronjob aufgerufen wird und jeden Abend neue Bilder einsortiert.

```sh
#!/bin/sh

# Basisverzeichnis
DIR="/tank/private"

# Bilder sortieren
# -r rekursiv
# '-FileName<DateTimeOriginal' zuerst das Datum nutzen wann das Bild geschossen wurde
# '-FileName<CreateDate' ansonsten das Datum wann die Datei erstellt wurde
# -d "$DIR/sorted/%Y/%m/%d/%f%%-c.%%le" Zielverzeichnis (Jahr/Monat/Tag) und Dateiname
# der Dateiname setzt sich aus dem Originalnamen %f, ggf einer fortlaufender Nummer %%-c und der kleingeschriebenen Dateierweiterung 
# "$DIR/unsorted" Unsortiere Quelle
exiftool -r '-FileName<CreateDate' '-FileName<DateTimeOriginal' -d "$DIR/sorted/%Y/%m/%d/%f%%-c.%%le" "$DIR/unsorted"

# Moegliche leere Verzeichnisse entfernen
find "$DIR/unsorted" -type d -empty -delete

# Rechte richtig setzen
chmod -R 775 "$DIR/sorted"
chown -R root:data "$DIR/sorted"
```
