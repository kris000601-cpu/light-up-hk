import json
d=json.load(open('xianggang.json'))
scale=d.get('UTF8Scale',1024)
def dec(s,off):
    px,py=off;res=[]
    for i in range(0,len(s),2):
        x=ord(s[i])-64;y=ord(s[i+1])-64
        x=(x>>1)^(-(x&1));y=(y>>1)^(-(y&1))
        x+=px;y+=py;px,py=x,y
        res.append([x/scale,y/scale])
    return res
out={"type":"FeatureCollection","features":[]}
for f in d['features']:
    g=f['geometry'];offs=g['encodeOffsets']
    if g['type']=='Polygon':
        coords=[dec(r,o) for r,o in zip(g['coordinates'],offs)]
    else:
        coords=[[dec(r,o) for r,o in zip(poly,po)] for poly,po in zip(g['coordinates'],offs)]
    out['features'].append({"type":"Feature","properties":{"name":f['properties']['name']},"geometry":{"type":g['type'],"coordinates":coords}})
json.dump(out,open('hk18.geojson','w'),ensure_ascii=False)
import itertools
for f in out['features']:
    g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    pts=[p for poly in polys for ring in poly for p in ring]
    print(f['properties']['name'],len(polys),len(pts),round(min(p[0] for p in pts),3),round(max(p[0] for p in pts),3),round(min(p[1] for p in pts),3),round(max(p[1] for p in pts),3))
