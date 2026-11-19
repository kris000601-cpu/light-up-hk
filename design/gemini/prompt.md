# 用 Gemini 生成景點章面圖案

目的：每個景點一個專屬的簡筆圖案，畫法跟原型「尖沙咀鐘樓」一樣（`reference-clock.png`）。
Gemini 畫的是草稿：Claude 收到後會清理雜點、統一線條粗細、轉成矢量線，再放進章面。

## 步驟

1. 打開 Gemini（App 或 gemini.google.com），選「製作圖片」。
2. **先上載 `reference-clock.png`**（風格參考），再貼下面的提示詞，把最後一行換成要畫的景點。
3. 滿意的話，在**同一個對話**裏接着說：「Same style, same stroke weight, same base. Now draw: ……」，畫下一個（同一個對話裏風格比較一致）。
4. 不滿意就說哪裏不對，例如「Too much detail, remove the windows」「Flat front view, no perspective」。
5. 每張滿意的圖下載下來，在聊天裏發給 Claude，說明是哪個景點。

提示詞用英文，因為圖像模型對英文的風格描述理解得更準。

## 提示詞（每次都貼這一段，只改最後一行）

```
Draw a minimalist monoline pictogram in EXACTLY the same style as the attached reference image (a clock tower).

Style rules — follow all of them:
- ONE subject only, centred, front elevation (flat, no perspective, no 3D), filling about 80% of the height.
- Build the subject from simple geometric shapes stacked from top to bottom (triangles, rectangles, circles, arcs). Use left–right symmetry wherever the real subject allows.
- Add only one or two small identifying details (like the clock face and the arched door in the reference). Details must be smaller than the main forms. No other decoration.
- Uniform line weight identical to the reference (about 3% of the image width), rounded line caps and rounded joins.
- Outlines only: no fills, no solid black areas, no shading, no hatching, no gradients, no texture, no hand-drawn wobble.
- Single colour #1E2B3C on a pure white background.
- Base: a straight horizontal ground line at about 80% of the image height; at most one or two very low, simple shapes beside the subject on that line. Below the ground line, two rows of gentle wave lines, the second row shorter (if the place is by the sea). If the place is inland, use two straight horizontal lines instead, the second shorter.
- Generous empty space around the drawing. Square 1:1, 1024 × 1024.
- It must stay clear and recognisable when shrunk to 66 pixels wide.
- NO text, letters, numbers or signs with writing. NO people, animals (unless the subject is an animal), sun, moon, clouds, birds, stars or trees floating around.

Subject: <把這一行換成下面的景點描述>
```

## 景點描述範例（貼在「Subject:」後面）

先試這幾個，看 Gemini 的效果：

| 景點 | Subject（貼這句） |
|---|---|
| 太平山頂 · 獅子亭 | The Lions Pavilion on Victoria Peak, Hong Kong: a small traditional Chinese pavilion with a curved, upturned roof, a ball finial on top, and slim columns, standing on a stone platform overlooking the harbour (sea base). |
| 天壇大佛 | The Tian Tan Buddha on Lantau Island, Hong Kong: a giant seated Buddha in front view, right hand raised, sitting on a lotus throne on top of a three-tier round altar with steps in the middle (inland base). |
| 長洲 | The Cheung Chau Bun Festival bun tower, Hong Kong: a tall cone-shaped tower covered in rows of small round buns, held by a bamboo scaffold frame, with a tiny flag on top (sea base). |
| 黃大仙祠 | The main hall of Wong Tai Sin Temple, Hong Kong: a Chinese temple front with a double-eaved roof, upturned ridge ends, a round ornament in the middle of the ridge, red-pillar colonnade and a central doorway (inland base). |
| 鯉魚門 · 燈塔 | The small Lei Yue Mun lighthouse, Hong Kong: a short white lighthouse with a round lantern room and a domed cap, standing on a few large rocks at the water's edge (sea base). |
| 南丫島 · 榕樹灣 | Lamma Island, Hong Kong: the three tall chimneys of the Lamma power station rising behind a low green hill, seen from the sea (sea base). |
| 龍脊 | The Dragon's Back ridge trail, Hong Kong: a gently undulating mountain ridge seen from the side, with a single hiking trail distance post standing on the highest point (inland base). |
| 大館 | Tai Kwun, Hong Kong: the front of the colonial-era Barrack Block, a four-storey building with rows of arched verandas on every floor, a flat roofline, and a central entrance (inland base). |

其他景點的描述，Claude 可以按需要再寫。
