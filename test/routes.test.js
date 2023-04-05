// routes.test.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const chai = require('chai');
const chaiHttp = require('chai-http');
const { app, startServer } = require('../test_server');
const expect = chai.expect;

chai.use(chaiHttp);

describe('Routes API', () => {
  // Replace 'your-app-token' with the actual token
  const appToken = process.env.TRAILBLAZE_APP_TOKEN;

  before(async (done) => {
    app.on('ready', () => {
      done();
    });
    startServer();
  });

  describe('POST /routes/create-route', () => {
    it('should create a route', (done) => {

      const requestBody = {
        profile: "walking",
        distance: 5,
        waypoints: [
          "{\"type\":\"Feature\",\"id\":\"poi.137439042279\",\"geometry\":{\"coordinates\":[-80.484132,43.479668],\"type\":\"Point\"},\"properties\":{\"foursquare\":\"4ed668428b816659938dea96\",\"landmark\":true,\"address\":\"574 Lancaster St. W.\",\"category\":\"barbeque joint, bbq, barbeque\"},\"text\":\"The Lancaster Smokehouse\",\"place_name\":\"The Lancaster Smokehouse, 574 Lancaster St. W., Kitchener, Ontario N2K 1M3, Canada\",\"place_type\":[\"poi\"],\"center\":[-80.484132,43.479668],\"context\":[{\"id\":\"neighborhood.2657319\",\"text\":\"Bridgeport West\"},{\"id\":\"postcode.4473441831\",\"text\":\"N2K 1M3\"},{\"id\":\"locality.116116007\",\"text\":\"Bridgeport\",\"wikidata\":\"Q115178077\"},{\"id\":\"place.37349415\",\"text\":\"Kitchener\",\"wikidata\":\"Q200166\"},{\"id\":\"district.1615399\",\"text\":\"Waterloo County\",\"wikidata\":\"Q7974224\"},{\"id\":\"region.17447\",\"text\":\"Ontario\",\"short_code\":\"CA-ON\",\"wikidata\":\"Q1904\"},{\"id\":\"country.8743\",\"text\":\"Canada\",\"short_code\":\"ca\",\"wikidata\":\"Q16\"}],\"relevance\":1.0}",
          "{\"type\":\"Feature\",\"id\":\"poi.481036385043\",\"geometry\":{\"coordinates\":[-80.480759,43.4759],\"type\":\"Point\"},\"properties\":{\"foursquare\":\"4b57d2d3f964a520cf4228e3\",\"landmark\":true,\"address\":\"111 Westmount Rd S\",\"category\":\"financial and legal services, finance, lawyer, law\"},\"text\":\"Economical Insurance\",\"place_name\":\"Economical Insurance, 111 Westmount Rd S, Kitchener, Ontario N2K 3S2, Canada\",\"place_type\":[\"poi\"],\"center\":[-80.480759,43.4759],\"context\":[{\"id\":\"neighborhood.2657319\",\"text\":\"Bridgeport West\"},{\"id\":\"postcode.4476423719\",\"text\":\"N2K 3S2\"},{\"id\":\"place.37349415\",\"text\":\"Kitchener\",\"wikidata\":\"Q200166\"},{\"id\":\"district.1615399\",\"text\":\"Waterloo County\",\"wikidata\":\"Q7974224\"},{\"id\":\"region.17447\",\"text\":\"Ontario\",\"short_code\":\"CA-ON\",\"wikidata\":\"Q1904\"},{\"id\":\"country.8743\",\"text\":\"Canada\",\"short_code\":\"ca\",\"wikidata\":\"Q16\"}],\"relevance\":1.0}",
          "{\"type\":\"Feature\",\"bbox\":[-80.564139,43.464256,-80.53793,43.485681],\"id\":\"neighborhood.25029671\",\"geometry\":{\"coordinates\":[-80.5524,43.481281],\"type\":\"Point\"},\"properties\":{\"mapbox_id\":\"dXJuOm1ieHBsYzpBWDNzSnc\"},\"text\":\"University of Waterloo Research and Technology Park\",\"place_name\":\"University of Waterloo Research and Technology Park, Waterloo, Ontario, Canada\",\"place_type\":[\"neighborhood\"],\"center\":[-80.5524,43.481281],\"context\":[{\"id\":\"postcode.4486073895\",\"text\":\"N2L 6R2\"},{\"id\":\"locality.142641703\",\"text\":\"Lakeshore Village\",\"wikidata\":\"Q115178263\"},{\"id\":\"place.84789287\",\"text\":\"Waterloo\",\"wikidata\":\"Q639408\"},{\"id\":\"district.1615399\",\"text\":\"Waterloo County\",\"wikidata\":\"Q7974224\"},{\"id\":\"region.17447\",\"text\":\"Ontario\",\"short_code\":\"CA-ON\",\"wikidata\":\"Q1904\"},{\"id\":\"country.8743\",\"text\":\"Canada\",\"short_code\":\"ca\",\"wikidata\":\"Q16\"}],\"relevance\":1.0}",
        ],
      }

      chai
        .request(app)
        .post('/routes/create-route')
        .set('TRAILBLAZE-APP-TOKEN', appToken)
        // .set('content-type', 'application/json')
        .send(requestBody)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('routes');
          expect(res.body.routes).to.be.an('array');

          expect(res.body).to.have.property('waypoints');
          expect(res.body.waypoints).to.be.an('array');

          done();
        });
    });
  });
});
