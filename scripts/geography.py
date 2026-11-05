import csv,io,json,zipfile,urllib.request,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
raw=zipfile.ZipFile(io.BytesIO(urllib.request.urlopen('https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip',timeout=30).read())).read('2025_Gaz_counties_national.txt').decode()
rows=list(csv.DictReader(io.StringIO(raw),delimiter='|')) if '|' in raw.splitlines()[0] else list(csv.DictReader(io.StringIO(raw),delimiter='\t'))
places=[]
for r in rows:
 r={k.strip():v.strip() for k,v in r.items()}
 if r['USPS']=='PR':places.append(dict(id=r['GEOID'],name=r['NAME'].replace(' Municipio',''),lat=float(r['INTPTLAT']),lon=float(r['INTPTLONG']),region='pr',kind='Municipio'))
co=json.load(urllib.request.urlopen('https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=1200',timeout=30))
for r in co:
 if r['cod_dpto'] in ['11','25']:places.append(dict(id=r['cod_mpio'],name=r['nom_mpio'].title(),lat=float(r['latitud'].replace(',','.')),lon=float(r['longitud'].replace(',','.')),region='co',kind='Distrito' if r['cod_dpto']=='11' else 'Municipio'))
# Centros aproximados de localidad, no límites administrativos. Fuente: localidades de Bogotá / Geoportal IDECA.
localities=[('Usaquén',4.748,-74.031),('Chapinero',4.647,-74.049),('Santa Fe',4.596,-74.03),('San Cristóbal',4.548,-74.084),('Usme',4.479,-74.126),('Tunjuelito',4.571,-74.132),('Bosa',4.616,-74.195),('Kennedy',4.626,-74.151),('Fontibón',4.681,-74.148),('Engativá',4.708,-74.111),('Suba',4.752,-74.092),('Barrios Unidos',4.671,-74.074),('Teusaquillo',4.646,-74.093),('Los Mártires',4.605,-74.091),('Antonio Nariño',4.589,-74.102),('Puente Aranda',4.617,-74.119),('La Candelaria',4.596,-74.073),('Rafael Uribe Uribe',4.565,-74.115),('Ciudad Bolívar',4.507,-74.158),('Sumapaz',4.035,-74.315)]
for i,(name,lat,lon) in enumerate(localities,1):places.append(dict(id=f'bog-{i:02}',name=name+' · Bogotá',lat=lat,lon=lon,region='co',kind='Localidad · punto aproximado'))
places.sort(key=lambda p:p['name'])
(root/'src/data/places.json').write_text(json.dumps(places,ensure_ascii=False))
print('Geography',len([p for p in places if p['region']=='pr']),len([p for p in places if p['kind']=='Municipio' and p['region']=='co']),len(localities));print([p for p in places if 'San Juan'==p['name']])
