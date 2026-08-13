/* ═══════════════════════════════════════════════════════════════
   Rodizio · Meseros — vanilla JS, un solo archivo, sin build.
   Los pedidos viven en Firebase Realtime Database (REST + SSE),
   así que se sincronizan al instante con el Panel de cocina.
   Sesión: guard de Firebase Authentication + rol "mesero" (ver
   shared/auth.js y shared/roles.js) — el login en sí ocurre en el
   login raíz (/index.html); esta app solo verifica y, si falla,
   redirige de vuelta ahí.
   ═══════════════════════════════════════════════════════════════ */

      /* ── Menú completo de Rodizio Cúcuta ── */
      const MENU = [
        {
          cat: 'Entradas',
          items: [
            {
              id: 'en1',
              nombre: 'Crema de Pollo ó Champiñones',
              desc: 'Suave crema elaborada en bechamel, a base de pechuga de pollo o champiñones.',
              precio: 24000,
            },
            {
              id: 'en2',
              nombre: 'Sopa del Día',
              desc: 'Exquisita sopa especial de la casa a base de plátano, verduras y trocitos de carne seleccionadas.',
              precio: 20000,
            },
            {
              id: 'en3',
              nombre: 'Coctel de Camarón',
              desc: '200 grs de camarones bañados en salsa golf o en salsa roja.',
              precio: 35000,
            },
            {
              id: 'en4',
              nombre: 'Tuna a la Tártara',
              desc: 'Ensalada de la casa a base de atún, salsa tártara Rodizio, aguacate y tomate cherry, coronado con un crocante tostón.',
              precio: 25000,
            },
            {
              id: 'en5',
              nombre: 'Ensalada al César',
              desc: 'Clásica mezcla de lechuga, crutones, tocineta y queso parmesano con aderezo césar.',
              precio: 20000,
            },
          ],
        },
        {
          cat: 'Para Compartir',
          items: [
            {
              id: 'pc1',
              nombre: 'Rodizio Casero',
              desc: '1000 gramos de proteína: punta de anca, chata, morrillo, chunchulla, lomito de cerdo, chorizo, morcilla y ubre, acompañado…',
              precio: 149900,
            },
            {
              id: 'pc2',
              nombre: 'Tostones de la Casa',
              desc: 'Crujientes y tostaditos platanitos acompañados de nuestra inigualable salsa tártara Rodizio.',
              precio: 10000,
            },
            {
              id: 'pc3',
              nombre: 'Porción de Morcillas',
              desc: 'Cuatro (4) inigualables y únicas morcillitas acompañadas de papa salada y yuca al vapor.',
              precio: 15000,
            },
            {
              id: 'pc4',
              nombre: 'Porción de Chorizo',
              desc: 'Dos chorizos importados al mejor estilo uruguayo acompañados de papa salada.',
              precio: 18000,
            },
            {
              id: 'pc5',
              nombre: 'Porción de Chicharrón',
              desc: '300 grs de chicharrón de cerdo acompañado de yuca al vapor y limoncito.',
              precio: 32000,
            },
            {
              id: 'pc6',
              nombre: 'Porción de Chunchulla ó Ubre',
              desc: '250 grs asadas a la parrilla acompañadas de papa salada o yuca al vapor. Recomendadísimo.',
              precio: 32000,
            },
            {
              id: 'pc7',
              nombre: 'Alitas Picantes',
              desc: '(12) Al mejor estilo americano, acompañadas de salsa miel-mostaza ó BBQ, ligeramente picantes.',
              precio: 32000,
            },
          ],
        },
        {
          cat: 'De la Parrilla',
          items: [
            {
              id: 'pa1',
              nombre: 'Rodizio a la Mesa',
              desc: 'Buffet de 10 diferentes cortes de carnes entre res, pollo, cerdo y vísceras, servido a la mesa sin límite de consumo. Acompa…',
              precio: 99900,
            },
            {
              id: 'pa2',
              nombre: 'Colita de Cuadril',
              desc: 'Corte selecto del chef, 400 grs de textura muy suave y mucho sabor, ubicado en la parte baja del sirloin.',
              precio: 80000,
            },
            {
              id: 'pa3',
              nombre: 'Plato Mixto',
              desc: 'Tradicional plato de la parrilla: churrasco, pollo, chinchulla, ubre y/o cerdo, con papa salada o a la francesa.',
              precio: 68000,
            },
            {
              id: 'pa4',
              nombre: 'Baby Beef',
              desc: 'Tierno corte de lomo fino sin grasa, asado a la parrilla.',
              precio: 70000,
            },
            {
              id: 'pa5',
              nombre: 'Punta de Anca',
              desc: 'Corte ubicado en el cuarto trasero de la res en su punto óptimo de maduración.',
              precio: 62000,
            },
            {
              id: 'pa6',
              nombre: 'Picada Especial',
              desc: '(Para tres personas) Churrasco, pechuga, lomo de cerdo, morcilla, chorizo, tostones, arepitas, papas a la francesa y en…',
              precio: 119000,
            },
            {
              id: 'pa7',
              nombre: 'Bife Chorizo',
              desc: 'Corte argentino del centro de la chata de res a la parrilla. Término sugerido 1/2 ó 3/4.',
              precio: 58000,
            },
            {
              id: 'pa8',
              nombre: 'Costillitas de Cerdo',
              desc: 'Seleccionadas costillas de cerdo a la parrilla, acompañadas de papas a la francesa. Elija entre BBQ y ahumada.',
              precio: 55000,
            },
            {
              id: 'pa9',
              nombre: 'Churrasco',
              desc: 'Jugoso centro de chata de res en corte mariposa con punto óptimo de maduración y exquisito sabor.',
              precio: 52000,
            },
            {
              id: 'pa10',
              nombre: 'Churrasco de Cerdo',
              desc: 'Jugoso centro de chata de cerdo en corte mariposa con punto óptimo de maduración y exquisito sabor.',
              precio: 46000,
            },
            {
              id: 'pa11',
              nombre: 'Pollo al Rodizio',
              desc: 'Deliciosas presas de pollo asadas (4) a la brasa.',
              precio: 38000,
            },
          ],
        },
        {
          cat: 'Angus Beef',
          items: [
            {
              id: 'ab1',
              nombre: 'New York Steak',
              desc: '350 grs de la más exquisita carne Angus Beef, tierna y ligeramente marmoleada, preparada a la brasa. Corte prove…',
              precio: 130000,
            },
            {
              id: 'ab2',
              nombre: 'Asado de Tira',
              desc: 'Se caracteriza por ser uno de los cortes de mayor marmoleo. 350 grs de la mejor carne del mundo Certified Angus Beef…',
              precio: 120000,
            },
            {
              id: 'ab3',
              nombre: 'Picanha',
              desc: 'Jugosa y tierna carne de novillo Certified Angus Beef servida en espada, cocinada a fuego lento, acompañada de feijoad…',
              precio: 315000,
            },
            {
              id: 'ab4',
              nombre: 'Tomahawk Steak',
              desc: 'Corte fino de res Certified Angus Beef, una de las piezas más solicitadas en la mesa del mundo. Se trata de un corte…',
              precio: 132000,
            },
            {
              id: 'ab5',
              nombre: 'Pincho Ipanema',
              desc: '280 grs de Picanha Certified Angus Beef acompañado de papas a la francesa, una arepita y una yuquita frita.',
              precio: 52000,
            },
            {
              id: 'ab6',
              nombre: 'Sirloin Steak',
              desc: '200 grs de lomo ancho de res importado, Angus Beef Certified.',
              precio: 60000,
            },
            {
              id: 'ab7',
              nombre: 'Espada Mundialista 2026',
              desc: '900 gramos de 3 cortes importados de 300 grs cada uno: sirloin, colita de cuadril y punta de anca de cerdo, acompañado…',
              precio: 269000,
            },
          ],
        },
        {
          cat: 'Burger Angus',
          items: [
            {
              id: 'ba1',
              nombre: 'La Gardel',
              desc: '200 grs de carne Certified Angus Beef a la parrilla, chorizo argentino y corte mariposa, bañado en auténtico chimichurri…',
              precio: 46000,
            },
            {
              id: 'ba2',
              nombre: 'La Mayamera',
              desc: '200 grs de carne Certified Angus Beef a la parrilla, 100 grs de queso asado, papitas fosforito, tocineta bañada en salsa BB…',
              precio: 46000,
            },
            {
              id: 'ba3',
              nombre: 'Donald Trump',
              desc: '200 grs de carne Certified Angus Beef a la parrilla, aritos de cebolla, queso cheddar, tocineta bañada en salsa BBQ, vege…',
              precio: 44000,
            },
            {
              id: 'ba4',
              nombre: 'De la Casa',
              desc: '200 grs de carne Certified Angus Beef a la parrilla, para los amantes de lo clásico: queso cheddar, tocineta, vegetales fre…',
              precio: 44000,
            },
          ],
        },
        {
          cat: 'De la Casa',
          items: [
            {
              id: 'dc1',
              nombre: 'Tri-mignon',
              desc: 'Combinación de (3) mignon de res, mignon de pollo y mignon de cerdo, bañados en tres diferentes salsas sobre una cama de puré de papa.',
              precio: 65000,
            },
            {
              id: 'dc2',
              nombre: 'Filet Mignon',
              desc: 'Clásico de la casa, medallones de lomo de res envueltos en tocineta bañados en nuestra inigualable salsa demiglace…',
              precio: 66000,
            },
            {
              id: 'dc3',
              nombre: 'Pollo a la Cremé',
              desc: 'Jugosa pechuga de pollo a la plancha bañada en salsa blanca con camarones ó champiñones.',
              precio: 53000,
            },
            {
              id: 'dc4',
              nombre: 'Carne y Pasta',
              desc: 'Fetuccini o espagueti en salsa a elegir: 4 quesos, carbonara o napolitana. Elija entre churrasco, punta o baby beef.',
              precio: 53000,
            },
            {
              id: 'dc5',
              nombre: 'Lomito al Strogonoff',
              desc: '(250 grs) Exquisito lomito fino cortado en tiras, bañado en salsa de vino y champiñones.',
              precio: 48000,
            },
            {
              id: 'dc6',
              nombre: 'Milanesa Napolitana',
              desc: 'Lomo fino de res apanado con jamón, queso y bañado en salsa napolitana al gratín.',
              precio: 50000,
            },
            {
              id: 'dc7',
              nombre: 'Pollo a la Diabla',
              desc: 'Deliciosa pechuga bañada en salsa rubia con un toque de pimienta y mostaza, acompañada de papas a la francesa.',
              precio: 49000,
            },
          ],
        },
        {
          cat: 'Del Mar',
          items: [
            {
              id: 'dm1',
              nombre: 'Mixto de Mariscos',
              desc: 'Inigualable combinación de frutos del mar a la parrilla: mejillones, palmitos del mar, pota, calamar, pulpo, langostinos…',
              precio: 108000,
            },
            {
              id: 'dm2',
              nombre: 'Langostinos',
              desc: '(6) Seleccionados langostinos directo del mar a la mesa. Elija entre Thermidor, al ajillo, al gratín o apanado de coco…',
              precio: 98000,
            },
            {
              id: 'dm3',
              nombre: 'Salmón Marinera',
              desc: 'Filete de salmón a la plancha bañado en salsa de frutos del mar (calamar, pulpo, caracol, almeja y mejillón).',
              precio: 95000,
            },
            {
              id: 'dm4',
              nombre: 'Róbalo Marinera',
              desc: 'Filete de róbalo a la plancha bañado en salsa de frutos del mar (calamar, pulpo, caracol, almeja y mejillón).',
              precio: 75000,
            },
            {
              id: 'dm5',
              nombre: 'Salmón Fusión',
              desc: 'Filete de salmón a la parrilla bañado en salsa de lulo y soya, acompañado de arroz oriental.',
              precio: 75000,
            },
            {
              id: 'dm6',
              nombre: 'Cazuela de Mariscos',
              desc: 'Plato típico de las costas colombianas al gratín con pulpo, calamar, almeja, caracol, camarón y langostinos.',
              precio: 71000,
            },
            {
              id: 'dm7',
              nombre: 'Paella Española',
              desc: '(Para dos personas) Plato típico de la gastronomía española a base de arroz, vegetales, carnes y mariscos cocinados…',
              precio: 120000,
            },
            {
              id: 'dm8',
              nombre: 'Salmón de la Casa',
              desc: 'Generosa porción de filete de salmón a la plancha acompañado de arroz negro en tinta de calamar.',
              precio: 75000,
            },
            {
              id: 'dm9',
              nombre: 'Róbalo Buena Mujer',
              desc: 'Filete de róbalo en salsa de champiñones y camarones gratinado, servido en una cama de puré de papa.',
              precio: 71000,
            },
            {
              id: 'dm10',
              nombre: 'Róbalo a la Cremé',
              desc: 'Filete de róbalo con camarón y/o champiñón bañado en una deliciosa salsa rubia al gratín.',
              precio: 71000,
            },
          ],
        },
        {
          cat: 'Menú Infantil',
          items: [
            {
              id: 'mi1',
              nombre: 'Mini - Hamburguesa',
              desc: 'Acompañado de papas a la francesa, un juguito y un juguete y sorpresa.',
              precio: 28000,
            },
            {
              id: 'mi2',
              nombre: 'Pechuguita Apanada',
              desc: 'Acompañado de papas a la francesa, un juguito y un juguete y sorpresa.',
              precio: 28000,
            },
            {
              id: 'mi3',
              nombre: 'Nuggets de Pollo',
              desc: 'Acompañado de papas a la francesa, un juguito y un juguete y sorpresa.',
              precio: 28000,
            },
            {
              id: 'mi4',
              nombre: 'Mini - Perro',
              desc: 'Acompañado de papas a la francesa, un juguito y un juguete y sorpresa.',
              precio: 28000,
            },
          ],
        },
        {
          cat: 'Postres',
          items: [
            {
              id: 'po1',
              nombre: 'Mousse de Maracuyá',
              desc: 'Típico de la gastronomía brasileña, súper refrescante.',
              precio: 15000,
            },
            {
              id: 'po2',
              nombre: 'Brownie con Helado',
              desc: 'Brownie de chocolate caliente cubierto de una bolita de helado de vainilla bañado en salsa de caramelo.',
              precio: 12000,
            },
            {
              id: 'po3',
              nombre: 'Quesillo',
              desc: 'Delicioso y suave quesillo de leche bañado en salsa de caramelo.',
              precio: 12000,
            },
            {
              id: 'po4',
              nombre: 'Brevas con Arequipe',
              desc: 'Típico postre bogotano que se prepara con brevas cocidas en azúcar o caramelo, cubiertas con arequipe.',
              precio: 12000,
            },
            {
              id: 'po5',
              nombre: 'Arequipe Flambeado',
              desc: 'Arequipe gratinado con queso mozzarella y parmesano, flambeado con coñac.',
              precio: 12000,
            },
            {
              id: 'po6',
              nombre: 'Copa de Helado',
              desc: 'Helado de vainilla bañado con salsa de chocolate.',
              precio: 15000,
            },
          ],
        },
        {
          cat: 'Bebidas',
          items: [
            { id: 'be1', nombre: 'Limonada Cerezada', desc: '', precio: 15000 },
            { id: 'be2', nombre: 'Limonada de Coco', desc: '', precio: 15000 },
            {
              id: 'be3',
              nombre: 'Jugos Naturales',
              desc: 'Sabor de su preferencia.',
              precio: 11000,
            },
            {
              id: 'be4',
              nombre: 'Frappes',
              desc: 'Sabor de su preferencia.',
              precio: 11000,
            },
            {
              id: 'be5',
              nombre: 'Coca-Cola Pet 400 ml',
              desc: 'Mezcla de azúcar y aceites de naranja, limón y vainilla.',
              precio: 7000,
            },
            {
              id: 'be6',
              nombre: 'Coca-Cola Zero Pet 400 ml',
              desc: 'Zero es una de las variantes no calóricas de Coca-Cola.',
              precio: 7000,
            },
            {
              id: 'be7',
              nombre: 'Manzana Postobón 400 ml',
              desc: 'Bebida gaseosa ideal para refrescar y quitar la sed, aspecto líquido color rosado, refrescante.',
              precio: 6000,
            },
            {
              id: 'be8',
              nombre: 'Uva Postobón 400 ml',
              desc: 'Con un dulce sabor a uva, refrescante, colorida y la favorita para los colombianos.',
              precio: 6000,
            },
            {
              id: 'be9',
              nombre: '7up 400 ml',
              desc: 'A base de agua carbonatada con sabor a lima o limón, incolora y sin cafeína.',
              precio: 6000,
            },
            {
              id: 'be10',
              nombre: 'Colombiana 400 ml',
              desc: 'Con un sabor espumoso de cola champán, perfecta para fiestas, reuniones y picnics.',
              precio: 6000,
            },
            {
              id: 'be11',
              nombre: 'Hipinto 400 ml',
              desc: 'Bebida gaseosa que representa la cultura santandereana, sabores kola y piña.',
              precio: 6000,
            },
            {
              id: 'be12',
              nombre: 'Agua Mineral Manantial',
              desc: 'Agua sin gas Manantial.',
              precio: 9000,
            },
            {
              id: 'be13',
              nombre: 'Heineken 269 ml',
              desc: 'Ligero sabor dulce de la malta pilsen y su amargor suave, cerveza seca de cuerpo ligero.',
              precio: 10000,
            },
            {
              id: 'be14',
              nombre: 'Club Colombia Dorada 330 ml',
              desc: 'Ideal si quieres sentir en tu paladar el sabor refrescante y balanceado entre malta y lúpulo.',
              precio: 10000,
            },
            {
              id: 'be15',
              nombre: 'Club Colombia Roja 330 ml',
              desc: 'Notas ligeramente amargas que contrastan con los sabores dulces y caramelo.',
              precio: 10000,
            },
            {
              id: 'be16',
              nombre: 'Águila Original 355 ml',
              desc: 'Refrescante, con un sabor suave y un porcentaje moderado de alcohol.',
              precio: 10000,
            },
            {
              id: 'be17',
              nombre: 'Águila Light 330 ml',
              desc: 'Sabor suave con poco amargor.',
              precio: 10000,
            },
            {
              id: 'be18',
              nombre: 'Póker 330 ml',
              desc: 'Sabor amargo con un toque de notas dulces.',
              precio: 10000,
            },
            {
              id: 'be19',
              nombre: 'Coronita 210 ml',
              desc: 'Moderadamente dulce, recuerda el sabor del cereal. Amargor limpio y ligero.',
              precio: 12000,
            },
            {
              id: 'be20',
              nombre: 'Corona 355 ml',
              desc: 'Moderadamente dulce, recuerda el sabor del cereal. Amargor limpio y ligero.',
              precio: 15000,
            },
            {
              id: 'be21',
              nombre: 'Soda Hatsu Frambuesa & Rosas',
              desc: 'Soda rosa de sabor dulce y delicioso, mezcla frutal y herbal.',
              precio: 10000,
            },
            {
              id: 'be22',
              nombre: 'Soda Hatsu Limón & Hierbabuena',
              desc: 'Soda amarilla de sabor especial y aroma relajante, mezcla frutal y herbal.',
              precio: 10000,
            },
            {
              id: 'be23',
              nombre: 'Soda Hatsu Sandía & Albahaca',
              desc: 'Soda verde de sabor tropical y refrescante, mezcla frutal y herbal.',
              precio: 10000,
            },
            {
              id: 'be24',
              nombre: 'Soda Hatsu Uva Blanca & Romero',
              desc: 'Soda ámbar de sabor especial y aroma relajante, mezcla frutal y herbal.',
              precio: 10000,
            },
            {
              id: 'be25',
              nombre: 'Soda',
              desc: 'Perfecta para acompañar tus mejores momentos, bebida hecha de fusiones de sabores.',
              precio: 5000,
            },
            {
              id: 'be26',
              nombre: 'Bebida Energizante RedBull x 250 ml',
              desc: '',
              precio: 10000,
            },
            {
              id: 'be27',
              nombre: 'Canada Dry Ginger Ale',
              desc: 'Bebida refrescante, saborizada con sabor a jengibre, ideal para fusionar con otros sabores.',
              precio: 6000,
            },
            {
              id: 'be28',
              nombre: 'Canada Dry Agua Tónica',
              desc: 'Bebida gasificada y refrescante, aromatizada con quinina.',
              precio: 6000,
            },
            {
              id: 'be29',
              nombre: 'Té Hatsu Negro & Jugo de Limón',
              desc: 'Té revitalizante, saludable y refrescante, alto contenido de teína.',
              precio: 12000,
            },
            {
              id: 'be30',
              nombre: 'Té Hatsu Blanco sabor Mangostino',
              desc: 'Té blanco de sabor muy suave, hecho con las hojas más jóvenes de la planta.',
              precio: 12000,
            },
            {
              id: 'be31',
              nombre: 'Té Hatsu Carambolo & Flor de Loto',
              desc: 'Bebida de té 0 calorías y 0 carbohidratos, mezcla de carambolo y flor de loto.',
              precio: 12000,
            },
            {
              id: 'be32',
              nombre: 'Té Hatsu sabor a Granada & Mora Azul',
              desc: 'Bebida de té 0 calorías y 0 carbohidratos, mezcla de té blanco con granada y mora azul.',
              precio: 12000,
            },
            {
              id: 'be33',
              nombre: 'Té Hatsu Rojo sabor Frutos Rojos',
              desc: 'Té rojo, variedad exclusiva cultivada en China, gran significado histórico.',
              precio: 12000,
            },
            {
              id: 'be34',
              nombre: 'Té Hatsu Blanco sabor Flor de Cerezo',
              desc: 'Suave mezcla de té blanco con el sabor natural de flor de cerezo.',
              precio: 12000,
            },
          ],
        },
        {
          cat: 'Cervezas 3 Cordilleras',
          items: [
            {
              id: 'cc1',
              nombre: 'Blanca | 3 Cordilleras',
              desc: 'Cerveza tipo Wheat Ale color dorado, la puerta a nuestro mundo de cervezas artesanales.',
              precio: 12000,
            },
            {
              id: 'cc2',
              nombre: 'Mulata | 3 Cordilleras',
              desc: 'Cerveza tipo Amber Ale de color rojo intenso, combina todas las variedades de maltas.',
              precio: 12000,
            },
            {
              id: 'cc3',
              nombre: 'Rosada | 3 Cordilleras',
              desc: 'Cerveza tipo Rosé que causó sorpresa en el mercado por su color y tonos.',
              precio: 12000,
            },
            {
              id: 'cc4',
              nombre: 'Mestiza | 3 Cordilleras',
              desc: 'Cerveza tipo American Pale Ale, una fiesta de lúpulos americanos.',
              precio: 12000,
            },
            {
              id: 'cc5',
              nombre: 'Negra | 3 Cordilleras',
              desc: 'Cerveza tipo Stout inspirada en los sabores de los Andes, cargada de maltas tostadas.',
              precio: 12000,
            },
            {
              id: 'cc6',
              nombre: 'Mona | 3 Cordilleras',
              desc: 'Cerveza Premium tipo Blonde Ale, en los límites de la artesanalidad.',
              precio: 12000,
            },
          ],
        },
        {
          cat: 'Mocktails',
          items: [
            {
              id: 'mo1',
              nombre: 'Jamaiquino',
              desc: '(Foto sujeta a cambios y presentación) Concentrado sabor con zumo de limón.',
              precio: 14000,
            },
            {
              id: 'mo2',
              nombre: 'Lulo Mojito',
              desc: '(Foto sujeta a cambios y presentación) La acidez del lulo con el sabor refrescante del Té Hatsu.',
              precio: 14000,
            },
            {
              id: 'mo3',
              nombre: 'Mangostino Highball',
              desc: '(Foto sujeta a cambios y presentación) La canela se reconoce por sus propiedades calmantes y diuréticas.',
              precio: 14000,
            },
            {
              id: 'mo4',
              nombre: 'Soda de Mango Biche',
              desc: '(Foto sujeta a cambios y presentación) Una Bretaña bien helada con limón y mango biche.',
              precio: 14000,
            },
            {
              id: 'mo5',
              nombre: 'Caipineska',
              desc: '(Foto sujeta a cambios y presentación) El limón aporta propiedades como la vitamina C.',
              precio: 14000,
            },
            {
              id: 'mo6',
              nombre: 'Pink Tonic',
              desc: '(Foto sujeta a cambios y presentación) Un mocktail con identidad propia.',
              precio: 14000,
            },
          ],
        },
        {
          cat: 'Cocteles',
          items: [
            {
              id: 'co1',
              nombre: 'Cuba Libre',
              desc: 'Ron, coca-cola y limón.',
              precio: 22000,
            },
            {
              id: 'co2',
              nombre: 'Alexander',
              desc: 'Brandy, licor de café y helado de vainilla.',
              precio: 27000,
            },
            {
              id: 'co3',
              nombre: 'Mojito Cubano',
              desc: 'Ron blanco, hierbabuena, limón y soda Bretaña.',
              precio: 22000,
            },
            {
              id: 'co4',
              nombre: 'Gin - Tonic',
              desc: 'Ginebra y tónica Canada Dry.',
              precio: 22000,
            },
            {
              id: 'co5',
              nombre: 'Cosmopolitan',
              desc: 'Vodka, triple sec y jugo de arándanos.',
              precio: 22000,
            },
            {
              id: 'co6',
              nombre: 'Piña Colada',
              desc: 'Ron, piña, triple sec y crema de coco.',
              precio: 27000,
            },
            {
              id: 'co7',
              nombre: 'Martini Peach',
              desc: 'Vodka, triple sec y licor de durazno.',
              precio: 22000,
            },
            {
              id: 'co8',
              nombre: 'Margarita',
              desc: 'Tequila, triple sec y zumo de limón.',
              precio: 22000,
            },
            {
              id: 'co9',
              nombre: 'Passion Fruit',
              desc: 'Vodka, triple sec y jugo de maracuyá.',
              precio: 22000,
            },
            {
              id: 'co10',
              nombre: 'Daiquiri Tropical',
              desc: 'Ron, maracuyá y mora.',
              precio: 22000,
            },
            {
              id: 'co11',
              nombre: 'La Pecera',
              desc: 'Vodka, ginebra, tequila, triple sec, fresas picadas, cerezas, jugo de naranja y jugo de arándanos.',
              precio: 50000,
            },
            {
              id: 'co12',
              nombre: 'Jarra de Tinto de Verano',
              desc: 'Coctel a base de vino tinto, licor de naranja y 7up. (Rinde para 5 copas)',
              precio: 90000,
            },
          ],
        },
        {
          cat: 'Licores',
          items: [
            {
              id: 'li1',
              nombre: 'Tequila Don Julio Reposado',
              desc: 'Color paja con gran brillantez y tonos dorados, notas a agave cocido y miel.',
              precio: 780000,
            },
            {
              id: 'li2',
              nombre: 'Whisky Macallan Double Cask 12 Years',
              desc: 'Forma parte de la colección Double Cask, estilo clásico Macallan con dulzura inigualable.',
              precio: 900000,
            },
            {
              id: 'li3',
              nombre: "Whisky Buchanan's 18 Años",
              desc: 'Sabor intenso de primera línea, con profundidades de chocolate negro, cereza negra y almendras.',
              precio: 850000,
            },
            {
              id: 'li4',
              nombre: "Whisky Buchanan's Master",
              desc: 'Suave y afrutado, con notas de naranja y chocolate, ideal con soda.',
              precio: 650000,
            },
            {
              id: 'li5',
              nombre: "Whisky Jack Daniel's",
              desc: 'Dulce y picante, con foco de canela. En su final recuerda a galletas de canela.',
              precio: 300000,
            },
            {
              id: 'li6',
              nombre: "Whisky Buchanan's Deluxe",
              desc: 'Mezcla brillante de notas cítricas de naranja, combinadas con chocolate y miel.',
              precio: 350000,
            },
            {
              id: 'li7',
              nombre: 'Whisky Old Parr 12 Años',
              desc: 'Suave en la boca, dulce con mucha miel, pasas y canela, notas de frutas tropicales y naranjas.',
              precio: 370000,
            },
            {
              id: 'li8',
              nombre: 'Crema de Whisky Baileys trago',
              desc: 'Baileys Original Irish Cream, la combinación más dulce de whisky y licor.',
              precio: 25000,
            },
            {
              id: 'li9',
              nombre: 'Ron Viejo de Caldas 15 Años x 750 ml',
              desc: 'Gran reserva especial 15 años, de la caña de azúcar y añejado en barrica.',
              precio: 225500,
            },
            {
              id: 'li10',
              nombre: 'Ron Viejo de Caldas 8 Años x 750 ml',
              desc: 'Sabor a madera, tostado con notas ácidas frutales, herbales y de coco.',
              precio: 180000,
            },
            {
              id: 'li11',
              nombre: 'Ron Viejo de Caldas',
              desc: 'Tradicional, reconocido por su carácter y calidad excepcional.',
              precio: 120000,
            },
            {
              id: 'li12',
              nombre: 'Aguardiente Amarillo de Manzanares',
              desc: 'Elaborado con la mejor caña gorobeta, anís sembrado en Guadalupe y agua pura de nacimiento.',
              precio: 120000,
            },
            {
              id: 'li13',
              nombre: 'Aguardiente Antioqueño',
              desc: 'Elaborado con alcoholes extra puros, notas dulces y ligeramente suaves.',
              precio: 120000,
            },
            {
              id: 'li14',
              nombre: 'Vodka Smirnoff de Lulo x 375 ml',
              desc: 'Combina un aroma fuerte con un dulce y ligero sabor a lulo.',
              precio: 120000,
            },
            {
              id: 'li15',
              nombre: 'Vodka Absolut Regular x 375 ml',
              desc: 'Sabor rico con cuerpo y complejo, suave, con el carácter distintivo del grano de trigo.',
              precio: 100000,
            },
          ],
        },
        {
          cat: 'Vinos',
          items: [
            {
              id: 'vi1',
              nombre: 'Marqués de Riscal Reserva',
              desc: 'Color cereza muy cubierto, intenso y con apenas signos de evolución. Nariz muy expresiva.',
              precio: 440000,
            },
            {
              id: 'vi2',
              nombre: 'Trivento Golden Reserve Malbec',
              desc: 'Vino aromático con notas de ciruela, cereza y albaricoque silvestre.',
              precio: 350000,
            },
            {
              id: 'vi3',
              nombre: 'Marqués de Casa Concha Merlot',
              desc: 'Delicadas notas de grosella, especias, frutos del bosque y ciruela roja.',
              precio: 310000,
            },
            {
              id: 'vi4',
              nombre: 'Trivento Reserve Malbec',
              desc: 'Se destaca por su corazón frutal, volumen de boca y sensación golosa.',
              precio: 250000,
            },
            {
              id: 'vi5',
              nombre: 'Casillero del Diablo Dark Red',
              desc: 'Deslumbra por su color rojo oscuro e intenso, con toques de frutas negras.',
              precio: 300000,
            },
            {
              id: 'vi6',
              nombre: 'Casillero del Diablo Rosé',
              desc: 'Vino especial, elaborado con uvas tintas Shiraz vinificadas como blanco.',
              precio: 180000,
            },
            {
              id: 'vi7',
              nombre: 'C.D Cabernet Sauvignon',
              desc: 'Intensos aromas a cerezas, ciruelas y toques a vainilla y tostado.',
              precio: 165000,
            },
            {
              id: 'vi8',
              nombre: 'Casillero del Diablo Red Blend',
              desc: 'Maduro, con marcados aromas de cereza negra y ciruela, notas especiadas.',
              precio: 165000,
            },
            {
              id: 'vi9',
              nombre: 'Casillero del Diablo Sauvignon Blanc',
              desc: 'Toque mineral, estilo refrescante y frío, con aromas a durazno y grosellas.',
              precio: 165000,
            },
            {
              id: 'vi10',
              nombre: 'Casillero del Diablo Reserva Merlot',
              desc: 'Dócil, de suaves taninos, expresa frescor y dulzura.',
              precio: 165000,
            },
            {
              id: 'vi11',
              nombre: 'Casillero del Diablo Malbec',
              desc: 'Dulces y redondos taninos, aromas a moras y ciruelas negras con pimienta y vainilla.',
              precio: 165000,
            },
            {
              id: 'vi12',
              nombre: 'Casillero del Diablo Carmenere',
              desc: 'Variedad de Burdeos que florece en tierras chilenas, deliciosos aromas.',
              precio: 165000,
            },
            {
              id: 'vi13',
              nombre: 'Frontera Carmenere',
              desc: 'Brillante color rojo rubí y tonos violáceos, aromas a ciruelas y especias.',
              precio: 165000,
            },
            {
              id: 'vi14',
              nombre: 'Frontera Cabernet Sauvignon',
              desc: 'Ideal para disfrutar junto a los amigos y la familia.',
              precio: 110000,
            },
            {
              id: 'vi15',
              nombre: 'Frontera Sauvignon Blanc',
              desc: 'Color amarillo verdoso y aroma frutal, con notas cítricas y a pera.',
              precio: 110000,
            },
            {
              id: 'vi16',
              nombre: 'Cono Sur Reserva Especial Pinot Noir',
              desc: 'Del Valle de San Antonio, vino rojo-morado claro, profundo y brillante.',
              precio: 130000,
            },
            {
              id: 'vi17',
              nombre: 'Cono Sur Bicicleta Sauvignon B.',
              desc: 'Finas notas a pomelo combinadas con aromas a manzanas verdes y duraznos blancos.',
              precio: 110000,
            },
            {
              id: 'vi18',
              nombre: 'Cono Sur Bicicleta Merlot',
              desc: 'Aromas a frutos rojos, frutos del bosque y notas a cacao, mocha y tabaco.',
              precio: 110000,
            },
            {
              id: 'vi19',
              nombre: 'Cono Sur Bicicleta Cabernet S.',
              desc: 'Notas de ciruela, frambuesa y especias dulces, con chocolate y vainilla.',
              precio: 110000,
            },
            {
              id: 'vi20',
              nombre: 'Cono Sur Bicicleta Carmenere',
              desc: 'Notas frutales de guinda negra con toques de café, pimienta y tostado.',
              precio: 110000,
            },
            {
              id: 'vi21',
              nombre: 'Lambrusco Rosato',
              desc: 'Sabor suave y envolvente, fresco y ligero, notas frutales.',
              precio: 90000,
            },
          ],
        },
        {
          cat: 'Champagnes',
          items: [
            {
              id: 'ch1',
              nombre: 'Veuve Clicquot Rose Box',
              desc: 'El primer champán rosado mezclado conocido en el mundo, viveza y explosión de frutas.',
              precio: 1200000,
            },
            {
              id: 'ch2',
              nombre: 'M&C Brut Imperial',
              desc: 'Mucha intensidad a manzana verde y cítricos, aromas minerales y a flores blancas.',
              precio: 700000,
            },
            {
              id: 'ch3',
              nombre: 'Chandon Rosé',
              desc: 'El perfecto equilibrio entre frescura y cremosidad, agradable sensación dulce.',
              precio: 180000,
            },
            {
              id: 'ch4',
              nombre: 'Codorníu Clásico',
              desc: 'Codorníu Clásico Brut, el tradicional por antonomasia.',
              precio: 180000,
            },
          ],
        },
      ];
      const SUGERENCIAS = {
        Entradas: ['Sin cebolla', 'Sin picante', 'Para compartir'],
        'Para Compartir': ['Extra salsa', 'Sin picante', 'Para compartir'],
        'De la Parrilla': [
          'Término medio',
          'Bien asado',
          'Sin sal',
          'Poco grasa',
        ],
        'Angus Beef': ['Término medio', 'Bien asado', 'Poco grasa'],
        'Burger Angus': [
          'Sin cebolla',
          'Extra queso',
          'Papas aparte',
          'Término de la carne',
        ],
        'De la Casa': ['Sin picante', 'Salsa aparte', 'Poca sal'],
        'Del Mar': ['Sin picante', 'Salsa aparte'],
        'Menú Infantil': ['Sin salsa', 'Papas extra'],
        Postres: ['Sin crema', 'Al final de la mesa'],
        Bebidas: ['Sin hielo', 'Bien fría', 'Sin azúcar'],
        'Cervezas 3 Cordilleras': ['Bien fría', 'Sin vaso'],
        Mocktails: ['Sin hielo', 'Bien frío'],
        Cocteles: ['Sin hielo', 'Doble', 'Menos dulce'],
        Licores: ['Con hielo', 'Solo', 'Con soda'],
        Vinos: ['Bien frío', 'Temperatura ambiente'],
        Champagnes: ['Bien frío'],
      };
      const CATS = MENU.map((g) => g.cat);
      const ITEM_INDEX = {};
      MENU.forEach((g) =>
        g.items.forEach((i) => {
          ITEM_INDEX[i.id] = Object.assign({ cat: g.cat }, i);
        }),
      );
      const ETIQUETA = {
        enviado: 'Enviado',
        preparacion: 'En preparación',
        listo: 'Listo para servir',
        entregado: 'Servido',
      };
      const ESTADOS = ['enviado', 'preparacion', 'listo', 'entregado'];

      /* ── Firebase Realtime Database — REST + SSE, sin SDK ni apiKey ──
   DB_URL / dbUrl / dbGet / dbPush / dbUpdate / escucharSSE /
   aplicarEventoSSE / siguienteCodigo vienen de ../shared/firebase.js ── */

      // escapeHtml viene de ../shared/util.js. "cop" es solo un alias local
      // hacia fmtCop (mismo shared/util.js) para no tocar los usos de cop(...)
      // repartidos por el resto de este archivo.
      const cop = fmtCop;

      /* ── Estado de la app ──
   mesaId es solo la mesa que ELEGISTE en esta pantalla ahora mismo —
   una selección local, sin dueño ni reserva. Cualquier mesero puede
   elegir cualquier mesa (activa) en cualquier momento, esté o no
   ocupada, para agregarle una comanda nueva. Ver claude.md, sección
   "Mesas". ── */
      const defaultMesas = {};
      for (let i = 1; i <= 20; i++) {
        defaultMesas[`mesa-${i}`] = { nombre: `Mesa ${i}`, activa: true };
      }
      const state = {
        cargandoSesion: true,
        perfil: null,
        uid: null,
        mesero: '',
        mesaId: null,
        mesas: defaultMesas,
        tab: 'mesas',
        cat: CATS[0],
        carrito: [],
        comandaAbierta: false,
        pedidos: {},
        conectado: false,
        toast: '',
        editandoPedidoId: null,
        busqueda: '',
      };

      /* ── Persistencia del carrito por mesa ──
   carritosPorMesa guarda el carrito de cada mesa para que no se pierda
   al cambiar de pestaña o seleccionar otra mesa. */
      const carritosPorMesa = {};

      function guardarCarritoMesa() {
        if (state.mesaId) {
          carritosPorMesa[state.mesaId] = {
            carrito: state.carrito.map((l) => Object.assign({}, l)),
            editandoPedidoId: state.editandoPedidoId,
          };
        }
      }

      function restaurarCarritoMesa(mesaId) {
        const guardado = carritosPorMesa[mesaId];
        if (guardado && guardado.carrito.length > 0) {
          return {
            carrito: guardado.carrito.map((l) => Object.assign({}, l)),
            editandoPedidoId: guardado.editandoPedidoId,
          };
        }
        return { carrito: [], editandoPedidoId: null };
      }

      function limpiarCarritoMesa(mesaId) {
        delete carritosPorMesa[mesaId];
      }

      // La mesa elegida ahora mismo (objeto de state.mesas), o null.
      function mesaActual() {
        return state.mesaId ? state.mesas[state.mesaId] : null;
      }
      function nombreMesaActual() {
        const m = mesaActual();
        return m ? m.nombre : null;
      }

      // Ocupada = tiene al menos un pedido sin pagar — se calcula al vuelo
      // desde /pedidos (ya lo tenemos en memoria por el SSE de conectarPedidos),
      // no se guarda como bandera aparte. Así nunca puede quedar desincronizada.
      function mesaOcupada(id) {
        return Object.values(state.pedidos).some(
          (p) => p && p.mesaId === id && !p.pagado,
        );
      }

      function setState(patch) {
        Object.assign(state, patch);
        render();
      }
      function aviso(t) {
        window.mostrarToast(t);
      }

      /* ── Escucha en vivo de /pedidos (solo los del mesero en turno se muestran) ── */
      let primeraCargaPedidos = true;
      let prevEstados = {}; // id -> estado, para detectar cuándo un pedido pasa a "listo"

      function conectarPedidos() {
        const es = escucharSSE('/pedidos', (tipo, evento) => {
          state.pedidos = aplicarEventoSSE(state.pedidos, tipo, evento);
          Object.values(state.pedidos).forEach((p) => {
            if (p && p.mesa && !p.pagado) {
              let raw = String(p.mesa).trim();
              let numMatch = raw.match(/\d+/);
              let id = p.mesaId || (numMatch ? `mesa-${numMatch[0]}` : raw);
              let nombre = raw.toLowerCase().startsWith('mesa') ? raw : (numMatch ? `Mesa ${numMatch[0]}` : raw);
              if (!state.mesas[id]) {
                state.mesas[id] = { nombre, activa: true };
              }
            }
          });
          detectarPedidosListos();
          setState({ conectado: true });
        });
        es.onopen = () => setState({ conectado: true });
        es.onerror = () => setState({ conectado: false });
      }

      /* ── Mesas: generadas automáticamente (1 al 20) o agregadas localmente ── */

      // Elegir mesa es una selección local, nada más — no escribe en Firebase.
      // Cualquier mesero puede elegir cualquier mesa activa, esté libre u
      // ocupada. Al elegir una mesa ocupada, el carrito empieza VACÍO para
      // crear un pedido NUEVO (no se edita el existente automáticamente).
      // El carrito previo de la mesa actual se guarda antes de cambiar.
      function elegirMesa(id) {
        if (!state.mesas[id]) return;
        // Guardar carrito de la mesa actual antes de cambiar
        guardarCarritoMesa();
        // Restaurar carrito guardado de la mesa destino (si tenía algo pendiente)
        const restaurado = restaurarCarritoMesa(id);
        setState({
          mesaId: id,
          tab: 'menu',
          carrito: restaurado.carrito,
          editandoPedidoId: restaurado.editandoPedidoId,
          busqueda: '',
        });
      }

      // Editar pedido: solo para pedidos en estado "enviado", activado
      // explícitamente desde la vista de pedidos.
      function editarPedido(pedidoId) {
        const p = state.pedidos[pedidoId];
        if (!p || p.estado !== 'enviado') {
          aviso(
            'Solo se pueden editar pedidos que no han sido tomados por cocina',
          );
          return;
        }
        // Guardar carrito actual antes de entrar en modo edición
        guardarCarritoMesa();
        const carrito = (p.lineas || []).map((l) => Object.assign({}, l));
        const mesaId =
          p.mesaId ||
          Object.keys(state.mesas).find(
            (k) => state.mesas[k].nombre === p.mesa,
          );
        setState({
          mesaId: mesaId || state.mesaId,
          tab: 'menu',
          carrito,
          editandoPedidoId: pedidoId,
          busqueda: '',
        });
        aviso('Editando pedido ' + (p.codigo || pedidoId));
      }

      // Avisa (sonido + notificación del sistema) apenas un pedido del mesero
      // actual pasa a "listo" — sin importar en qué mesa o pestaña esté parado,
      // así no tiene que ir hasta la otra mesa a comprobar.
      function detectarPedidosListos() {
        Object.entries(state.pedidos).forEach(([id, p]) => {
          if (!p || p.mesero !== state.mesero) {
            prevEstados[id] = p ? p.estado : undefined;
            return;
          }
          const antes = prevEstados[id];
          if (
            p.estado === 'listo' &&
            antes !== 'listo' &&
            !primeraCargaPedidos
          ) {
            avisarListo(p);
          }
          prevEstados[id] = p.estado;
        });
        primeraCargaPedidos = false;
      }

      function pedirPermisoNotificaciones() {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }

      // Tono propio de "pedido listo" (distinto al de aviso de cocina/caja),
      // generado con la fábrica compartida crearBeep() de ../shared/util.js.
      const beepListo = crearBeep([740, 1040]);

      function avisarListo(p) {
        beepListo();
        aviso('🔔 ' + p.mesa + ' lista · ' + (p.codigo || ''));
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(p.mesa + ' lista para servir', {
              body: (p.codigo || 'Pedido') + ' · toca para ver el detalle',
              icon: 'icon-192.png',
              tag: 'rodizio-listo',
            });
          } catch (e) {}
        }
      }

      /* ── Auth — sesión de Firebase Authentication verificada contra el rol
   "mesero" en /trabajadores/{uid} (ver shared/auth.js y shared/roles.js).
   "admin" también pasa el guard de cualquier panel, para poder
   supervisar/probar sin necesitar cada rol asignado por separado.
   El login en sí ocurre en el login raíz (/index.html); esta app solo
   valida en cada carga y expulsa si no hay sesión, el perfil no existe,
   está inactivo, o no tiene el rol "mesero" (ni "admin"). ── */
      function esperarAuthListo() {
        return new Promise((resolve) => {
          (function chequear() {
            if (window.onAuthStateChanged && window.logout) resolve();
            else setTimeout(chequear, 30);
          })();
        });
      }

      async function salir() {
        await logout();
        window.location.href = '../index.html';
      }

      async function iniciarSesion() {
        await esperarAuthListo();
        onAuthStateChanged(async (user) => {
          if (!user) {
            window.location.href = '../index.html';
            return;
          }
          let perfil;
          try {
            perfil = await getWorkerProfile(user.uid);
          } catch (e) {
            window.location.href = '../index.html';
            return;
          }
          if (
            !perfil ||
            perfil.estado !== 'activo' ||
            (!hasRole(perfil, 'mesero') && !hasRole(perfil, 'admin'))
          ) {
            await logout();
            window.location.href = '../index.html';
            return;
          }
          setState({
            cargandoSesion: false,
            perfil,
            uid: user.uid,
            mesero: perfil.nombre || perfil.usuario || 'Mesero',
          });
          conectarPedidos();
          pedirPermisoNotificaciones();
        });
      }

      /* ── Carrito ── */
      function cambiar(id, delta) {
        const carrito = state.carrito.slice();
        const i = carrito.findIndex((l) => l.id === id);
        if (i === -1) {
          if (delta > 0) carrito.push({ id, qty: 1, nota: '' });
        } else {
          const q = carrito[i].qty + delta;
          if (q <= 0) carrito.splice(i, 1);
          else carrito[i] = Object.assign({}, carrito[i], { qty: q });
        }
        setState({ carrito });
      }
      function setNota(id, nota) {
        setState({
          carrito: state.carrito.map((l) =>
            l.id === id ? Object.assign({}, l, { nota }) : l,
          ),
        });
      }
      function total() {
        return state.carrito.reduce(
          (s, l) => s + ITEM_INDEX[l.id].precio * l.qty,
          0,
        );
      }

      /* ── Enviar comanda a Firebase ── */
      async function enviar() {
        const btn = document.getElementById('btnEnviar');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Enviando…';
        }
        const lineas = state.carrito.map((l) => ({
          id: l.id,
          nombre: ITEM_INDEX[l.id].nombre,
          cat: ITEM_INDEX[l.id].cat,
          qty: l.qty,
          precio: ITEM_INDEX[l.id].precio,
          nota: (l.nota || '').trim(),
        }));
        const totalPedido = lineas.reduce((s, l) => s + l.precio * l.qty, 0);
        const nombreMesa = nombreMesaActual();

        if (state.editandoPedidoId) {
          // Verificar que el pedido sigue en estado "enviado" (pudo haber avanzado
          // mientras el mesero editaba) — si ya no está en "enviado", crear uno nuevo.
          const pedidoExistente = state.pedidos[state.editandoPedidoId];
          if (pedidoExistente && pedidoExistente.estado === 'enviado') {
            try {
              await dbUpdate(`/pedidos/${state.editandoPedidoId}`, {
                lineas,
                total: totalPedido,
                tsModificado: Date.now(),
              });
              limpiarCarritoMesa(state.mesaId);
              setState({
                carrito: [],
                comandaAbierta: false,
                tab: 'pedidos',
                editandoPedidoId: null,
              });
              aviso('Comanda actualizada · ' + nombreMesa);
            } catch (e) {
              aviso('No se pudo actualizar — revisa la conexión');
            }
          } else {
            // Pedido ya fue tomado por cocina, crear uno nuevo en vez de sobreescribir
            aviso('Cocina ya tomó ese pedido — se creará uno nuevo');
            state.editandoPedidoId = null;
            await enviarNuevo(lineas, totalPedido, nombreMesa);
          }
        } else {
          await enviarNuevo(lineas, totalPedido, nombreMesa);
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Enviar a cocina';
        }
      }

      async function enviarNuevo(lineas, totalPedido, nombreMesa) {
        const codigo = await siguienteCodigo();
        const pedido = {
          // "mesa" guarda el NOMBRE (lo que muestran cocina y caja tal cual);
          // "mesaId" es la referencia a /mesas, usada solo para calcular si la
          // mesa sigue ocupada (mesaOcupada() en base a pedidos sin pagar).
          codigo,
          mesa: nombreMesa,
          mesaId: state.mesaId,
          mesero: state.mesero,
          meseroUsuario: state.perfil ? state.perfil.usuario : '',
          lineas,
          total: totalPedido,
          estado: 'enviado',
          ts: Date.now(),
        };
        try {
          await dbPush('/pedidos', pedido);
          limpiarCarritoMesa(state.mesaId);
          setState({
            carrito: [],
            comandaAbierta: false,
            tab: 'pedidos',
            editandoPedidoId: null,
          });
          aviso('Comanda ' + codigo + ' enviada a cocina · ' + nombreMesa);
        } catch (e) {
          aviso('No se pudo enviar — revisa la conexión');
        }
      }

      async function marcarServido(id) {
        try {
          await dbUpdate(`/pedidos/${id}`, {
            estado: 'entregado',
            tsCambio: Date.now(),
          });
        } catch (e) {
          aviso('No se pudo marcar como servido — revisa la conexión');
        }
      }

      /* ═══════════ RENDER ═══════════ */
      function render() {
        const el = document.getElementById('app');
        if (state.cargandoSesion) {
          el.innerHTML = renderCargando();
          return;
        }
        el.innerHTML = renderApp();
        bindApp();
        if (window.actualizarBotonInstalarPWA) window.actualizarBotonInstalarPWA();
        if (state.toast) {
          const t = document.createElement('div');
          t.className = 'toast';
          t.textContent = state.toast;
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 2600);
        }
      }

      function renderCargando() {
        return `
  <div class="auth-wrap">
    <div class="auth-logo"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20 L20 4" stroke="#f5ead8" stroke-width="2.4" stroke-linecap="round"/><circle cx="7.3" cy="16.7" r="3" fill="#f5ead8"/><circle cx="12" cy="12" r="3" fill="#f5ead8"/><circle cx="16.7" cy="7.3" r="3" fill="#f5ead8"/></svg></div>
    <h1 class="auth-title">Rodizio</h1>
    <p class="auth-sub">Verificando sesión…</p>
  </div>`;
      }

      function renderApp() {
        const activos = Object.values(state.pedidos).filter(
          (p) => p && p.mesero === state.mesero && p.estado !== 'entregado',
        );
        const listos = Object.values(state.pedidos).filter(
          (p) => p && p.mesero === state.mesero && p.estado === 'listo',
        );
        const nombreMesa = nombreMesaActual();
        return `
  <div class="topbar">
    <div class="avatar">${escapeHtml((state.mesero || '?').trim().charAt(0).toUpperCase())}</div>
    <div class="who"><b>${escapeHtml(state.mesero)}</b><span>${nombreMesa ? escapeHtml(nombreMesa) : 'Sin mesa'} · @${escapeHtml(state.perfil.usuario || '')}</span></div>
    <button class="btn-instalar-pwa" id="btnInstalarApp">📲 Instalar</button>
    <button class="logout" id="btnSalir">Salir</button>
  </div>
  <div class="tabs">
    <button class="tab ${state.tab === 'mesas' ? 'on' : ''}" id="tabMesas">Mesas</button>
    <button class="tab ${state.tab === 'pedidos' ? 'on' : ''}" id="tabPedidos">Pedidos ${activos.length ? '· ' + activos.length : ''}</button>
  </div>
  <p class="connbar">${state.conectado ? '● Conectado con cocina' : '○ Conectando con cocina…'}</p>
  ${listos.length ? `<button class="listos-banner" id="btnVerListos">🔔 ${listos.length === 1 ? '1 pedido listo' : listos.length + ' pedidos listos'} · ${listos.map((p) => p.mesa).join(', ')} — toca para ver</button>` : ''}
  <main>${state.tab === 'mesas' ? renderMesas() : state.tab === 'menu' ? (nombreMesa ? renderMenu() : renderSinMesa()) : renderPedidos()}</main>
  ${state.tab === 'menu' && nombreMesa && state.carrito.length && !state.comandaAbierta ? renderCartBar() : ''}
  ${renderDrawer()}
  `;
      }
      function renderSinMesa() {
        return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
    <p>Elige una mesa en la pestaña "Mesas" para empezar a tomar el pedido</p>
    <button class="cta" id="btnIrAMesas" style="margin-top:16px">Ver mesas</button>
  </div>`;
      }
      function renderMesas() {
        const mesasOrdenadas = Object.entries(state.mesas)
          .filter(([, m]) => m && m.activa !== false)
          .sort((a, b) => {
            const nomA = String(a[1].nombre || '');
            const nomB = String(b[1].nombre || '');
            const numA = parseInt(nomA.replace(/\D/g, ''));
            const numB = parseInt(nomB.replace(/\D/g, ''));
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB)
              return numA - numB;
            return nomA.localeCompare(nomB, 'es', { numeric: true });
          });

        return `<div class="mesas-grid">
    ${mesasOrdenadas
      .map(([id, m]) => {
        const ocupada = mesaOcupada(id);
        return `<button class="mesa-card ${id === state.mesaId ? 'elegida' : ''} ${ocupada ? 'ocupada' : ''}" data-id="${id}">
        <b>${escapeHtml(m.nombre)}</b>
        <small>${ocupada ? 'Ocupada' : 'Libre'}</small>
      </button>`;
      })
      .join('')}
    <button class="mesa-card" style="border:1.5px dashed var(--color-divider);background:transparent" id="btnNuevaMesa">
      <b style="font-size:20px;line-height:1;margin-bottom:2px">+</b>
      <small>Abrir otra</small>
    </button>
  </div>`;
      }
      // Quita acentos para búsqueda flexible
      function sinAcentos(s) {
        return s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      }

      function renderMenu() {
        const enCarrito = {};
        state.carrito.forEach((l) => (enCarrito[l.id] = l.qty));
        const termino = sinAcentos(state.busqueda || '').trim();
        const buscando = termino.length >= 2;

        // Si está buscando, mostrar resultados de TODAS las categorías
        let items = [];
        if (buscando) {
          MENU.forEach((g) =>
            g.items.forEach((it) => {
              if (
                sinAcentos(it.nombre).includes(termino) ||
                sinAcentos(it.desc).includes(termino)
              ) {
                items.push({ ...it, catLabel: g.cat });
              }
            }),
          );
        } else {
          const grupo = MENU.find((g) => g.cat === state.cat) || MENU[0];
          items = grupo.items.map((it) => ({ ...it, catLabel: null }));
        }

        const editandoLabel = state.editandoPedidoId
          ? `<div style="background:var(--color-accent-100);border:1px solid var(--color-accent-300);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--color-accent-700);display:flex;align-items:center;gap:8px">
        <span style="font-weight:700">✏️ Editando pedido</span>
        <button id="btnCancelarEdicion" style="margin-left:auto;border:1px solid var(--color-accent-300);background:transparent;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;color:var(--color-accent-700);cursor:pointer">Cancelar edición</button>
      </div>`
          : '';

        return `
  ${editandoLabel}
  <div class="menu-search-wrap">
    <svg class="menu-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input class="menu-search" id="menuSearch" type="text" placeholder="Buscar producto…" value="${escapeHtml(state.busqueda)}">
    ${state.busqueda ? '<button class="menu-search-clear" id="menuSearchClear">✕</button>' : ''}
  </div>
  ${!buscando ? `<div class="cats">${CATS.map((c) => `<button class="cat-pill ${c === state.cat ? 'on' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}</div>` : ''}
  ${items.length === 0 && buscando ? '<div class="empty-state" style="padding:30px 0"><p>No se encontraron productos con "' + escapeHtml(state.busqueda) + '"</p></div>' : ''}
  ${items
    .map((it) => {
      const q = enCarrito[it.id] || 0;
      return `<div class="plato ${q > 0 ? 'in' : ''}">
      <div class="plato-info">
        ${it.catLabel ? `<span class="plato-cat">${escapeHtml(it.catLabel)}</span>` : ''}
        <b>${escapeHtml(it.nombre)}</b><small>${escapeHtml(it.desc)}</small><span class="precio">${cop(it.precio)}</span>
      </div>
      <div class="stepper">
        ${q > 0 ? `<button data-quitar="${it.id}">–</button><span class="qty">${q}</span>` : ''}
        <button class="add" data-agregar="${it.id}">+</button>
      </div>
    </div>`;
    })
    .join('')}`;
      }
      function renderCartBar() {
        const unidades = state.carrito.reduce((n, l) => n + l.qty, 0);
        return `<button class="cart-bar" id="btnAbrirComanda"><b>${unidades} ítem${unidades === 1 ? '' : 's'}</b><span>${cop(total())}</span><span class="cta-mini">Ver comanda</span></button>`;
      }
      function renderDrawer() {
        const abierta = state.comandaAbierta;
        const lineas =
          state.carrito
            .map((l) => {
              const it = ITEM_INDEX[l.id];
              const sug = SUGERENCIAS[it.cat] || [];
              return `<div class="linea-row">
      <div class="linea-top">
        <b>${escapeHtml(it.nombre)}</b>
        <div class="stepper"><button data-quitar="${it.id}">–</button><span class="qty">${l.qty}</span><button class="add" data-agregar="${it.id}">+</button></div>
        <span class="sub">${cop(it.precio * l.qty)}</span>
      </div>
      ${sug.length ? `<div class="sug">${sug.map((t) => `<button class="${(l.nota || '').trim() === t ? 'on' : ''}" data-nota-chip="${it.id}" data-texto="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>` : ''}
      <input class="nota-input" placeholder="Nota para cocina (opcional)" data-nota="${it.id}" value="${escapeHtml(l.nota || '')}">
    </div>`;
            })
            .join('') ||
          `<p style="text-align:center;color:var(--color-neutral-500);padding:30px 0">Tu comanda está vacía</p>`;
        return `
  <div class="backdrop ${abierta ? 'show' : ''}" id="backdrop"></div>
  <div class="drawer ${abierta ? 'show' : ''}">
    <div class="drawer-head"><h3>Comanda · ${escapeHtml(nombreMesaActual() || '')}</h3><button class="drawer-close" id="btnCerrarDrawer">✕</button></div>
    <div class="drawer-body">${lineas}</div>
    <div class="drawer-foot">
      <div class="drawer-total"><span>Total</span><span>${cop(total())}</span></div>
      <div class="drawer-actions">
        <button class="btn-ghost" id="btnVaciar">Vaciar</button>
        <button class="btn-send" id="btnEnviar" ${state.carrito.length ? '' : 'disabled'}>Enviar a cocina</button>
      </div>
    </div>
  </div>`;
      }
      function renderPedidos() {
        const mios = Object.entries(state.pedidos)
          .filter(([, p]) => p && p.mesero === state.mesero)
          .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
        if (!mios.length) {
          return `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg><p>Aún no has enviado comandas en este turno</p></div>`;
        }
        return mios
          .map(([id, p]) => {
            const idx = ESTADOS.indexOf(p.estado);
            const min = Math.max(0, Math.round((Date.now() - p.ts) / 60000));
            const color =
              p.estado === 'listo'
                ? 'var(--color-accent-2-600)'
                : p.estado === 'entregado'
                  ? 'var(--color-neutral-500)'
                  : 'var(--color-accent)';
            const pasos = ['Enviado', 'En preparación', 'Listo', 'Servido'];
            // Botón de editar solo para pedidos en estado "enviado"
            const btnEditar =
              p.estado === 'enviado'
                ? `<button class="btn-servir" style="background:var(--color-accent);margin-top:8px" data-editar="${id}">✏️ Editar pedido</button>`
                : '';
            return `<div class="pedido-card ${p.estado === 'listo' ? 'listo' : ''}">
      <div class="p-top"><span class="p-mesa">${escapeHtml(String(p.mesa ?? '—'))}</span><span class="p-badge" style="background:${color}">${escapeHtml(ETIQUETA[p.estado] || p.estado)}</span></div>
      <p class="p-meta">${escapeHtml(p.codigo || id)} · hace ${min} min · ${(p.lineas || []).reduce((n, l) => n + l.qty, 0)} ítems</p>
      <div class="pasos">${pasos.map((nombre, i) => `<div><div class="paso-bar" style="background:${i <= idx ? color : 'var(--color-neutral-300)'}"></div><div class="paso-label" style="color:${i <= idx ? 'var(--color-neutral-800)' : 'var(--color-neutral-500)'}">${nombre}</div></div>`).join('')}</div>
      <div class="p-lineas">${(p.lineas || []).map((l) => `<div class="p-linea"><span class="desc">${l.qty}× ${escapeHtml(l.nombre)}${l.nota ? `<span class="nota">${escapeHtml(l.nota)}</span>` : ''}</span><span>${cop(l.precio * l.qty)}</span></div>`).join('')}</div>
      <div class="p-total"><span>Total</span><span>${cop(p.total)}</span></div>
      ${p.estado === 'listo' ? `<button class="btn-servir" data-servir="${id}">Marcar servido</button>` : ''}
      ${btnEditar}
    </div>`;
          })
          .join('');
      }

      function bindApp() {
        // Guardar carrito antes de cambiar de pestaña
        document.getElementById('tabMesas').onclick = () => {
          guardarCarritoMesa();
          setState({ tab: 'mesas' });
        };
        document.getElementById('tabPedidos').onclick = () => {
          guardarCarritoMesa();
          setState({ tab: 'pedidos' });
        };
        const btnVerListos = document.getElementById('btnVerListos');
        if (btnVerListos)
          btnVerListos.onclick = () => {
            guardarCarritoMesa();
            setState({ tab: 'pedidos' });
          };
        const btnIrAMesas = document.getElementById('btnIrAMesas');
        if (btnIrAMesas)
          btnIrAMesas.onclick = () => {
            guardarCarritoMesa();
            setState({ tab: 'mesas' });
          };

        document
          .querySelectorAll('.mesa-card[data-id]')
          .forEach((b) => (b.onclick = () => elegirMesa(b.dataset.id)));
        const btnNueva = document.getElementById('btnNuevaMesa');
        if (btnNueva) {
          btnNueva.onclick = () => {
            const nom = prompt(
              'Nombre o número para la nueva mesa (Ej: Mesa 21, Terraza, etc):',
            );
            if (nom && nom.trim()) {
              const id = 'custom_' + Date.now();
              state.mesas[id] = { nombre: nom.trim(), activa: true };
              elegirMesa(id);
            }
          };
        }

        document.getElementById('btnSalir').onclick = salir;

        // Buscador de menú — actualiza sin re-renderizar en cada tecla
        // para no perder foco del teclado en móvil
        const menuSearch = document.getElementById('menuSearch');
        if (menuSearch) {
          menuSearch.oninput = (e) => {
            state.busqueda = e.target.value;
            // Debounce: solo re-renderizar después de parar de escribir
            clearTimeout(window.__searchT);
            window.__searchT = setTimeout(() => render(), 200);
          };
          // Enfocar el campo si ya tenía texto (post re-render)
          if (state.busqueda) {
            menuSearch.focus();
            menuSearch.setSelectionRange(
              menuSearch.value.length,
              menuSearch.value.length,
            );
          }
        }
        const menuSearchClear = document.getElementById('menuSearchClear');
        if (menuSearchClear)
          menuSearchClear.onclick = () => setState({ busqueda: '' });

        // Cancelar edición
        const btnCancelarEdicion =
          document.getElementById('btnCancelarEdicion');
        if (btnCancelarEdicion)
          btnCancelarEdicion.onclick = () => {
            limpiarCarritoMesa(state.mesaId);
            setState({ carrito: [], editandoPedidoId: null });
          };

        document
          .querySelectorAll('[data-cat]')
          .forEach(
            (b) =>
              (b.onclick = () =>
                setState({ cat: b.dataset.cat, busqueda: '' })),
          );
        document
          .querySelectorAll('[data-agregar]')
          .forEach((b) => (b.onclick = () => cambiar(b.dataset.agregar, 1)));
        document
          .querySelectorAll('[data-quitar]')
          .forEach((b) => (b.onclick = () => cambiar(b.dataset.quitar, -1)));

        const abrir = document.getElementById('btnAbrirComanda');
        if (abrir) abrir.onclick = () => setState({ comandaAbierta: true });
        const backdrop = document.getElementById('backdrop');
        if (backdrop)
          backdrop.onclick = () => setState({ comandaAbierta: false });
        const cerrarD = document.getElementById('btnCerrarDrawer');
        if (cerrarD)
          cerrarD.onclick = () => setState({ comandaAbierta: false });
        const vaciar = document.getElementById('btnVaciar');
        if (vaciar)
          vaciar.onclick = () => {
            limpiarCarritoMesa(state.mesaId);
            setState({
              carrito: [],
              comandaAbierta: false,
              editandoPedidoId: null,
            });
          };
        const btnEnviar = document.getElementById('btnEnviar');
        if (btnEnviar) btnEnviar.onclick = enviar;

        // Igual que en los campos de auth: la nota se escribe sin re-renderizar
        // en cada tecla, para no perder el foco del teclado en móvil.
        document.querySelectorAll('[data-nota]').forEach(
          (inp) =>
            (inp.oninput = (e) => {
              const linea = state.carrito.find(
                (l) => l.id === inp.dataset.nota,
              );
              if (linea) linea.nota = e.target.value;
            }),
        );
        document.querySelectorAll('[data-nota-chip]').forEach(
          (b) =>
            (b.onclick = () => {
              const actual =
                (state.carrito.find((l) => l.id === b.dataset.notaChip) || {})
                  .nota || '';
              setNota(
                b.dataset.notaChip,
                actual.trim() === b.dataset.texto ? '' : b.dataset.texto,
              );
            }),
        );
        document
          .querySelectorAll('[data-servir]')
          .forEach((b) => (b.onclick = () => marcarServido(b.dataset.servir)));
        // Editar pedido desde la vista de pedidos
        document
          .querySelectorAll('[data-editar]')
          .forEach((b) => (b.onclick = () => editarPedido(b.dataset.editar)));
      }

      render();
      iniciarSesion();