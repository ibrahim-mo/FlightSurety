import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
// web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
let gasLimit = 3000000;


let registerOracles = async (accts) => {
  let owner = accts[0];
  let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call({from: owner});

  // we have contract ownner at account 0, then 5 registered airlines at accounts 1 - 6,
  // then 5 passengers at accounts 7 - 11
  let firstOracle = 12;
  let orcaleCount = 20;
  let oracles = [];
  for(let a=firstOracle; a<(firstOracle+orcaleCount); a++) {
      let oracle = accts[a];
      let isRegistered = await flightSuretyApp.methods.isOracle(oracle).call({from: owner});
      if (!isRegistered) {
          await flightSuretyApp.methods.registerOracle().send(
            { from: oracle, value: fee, gas: gasLimit }, (error, result) => {
                if (error) console.error(error);
            });
          let indexes = await flightSuretyApp.methods.getMyIndexes().call(
            { from: oracle, gas: gasLimit });
          console.log(`Oracle Registered: ${indexes[0]}, ${indexes[1]}, ${indexes[2]}`);
      }
      oracles.push(oracle);
  }

  return oracles;
};


(async() => {

    let accounts = await web3.eth.getAccounts();

    let oracles = await registerOracles(accounts);

    flightSuretyApp.events.OracleRequest({
        fromBlock: 0
      }, function (error, event) {
        if (error) console.log(error)
        console.log(event)

        // create a random status code from {10, 20, 30, 40, 50}
        let statusCode = Math.floor(Math.random() * 5 + 1) * 10
        let index = event.returnValues.index
        let airline = event.returnValues.airline
        let flight = event.returnValues.flight
        let timestamp = event.returnValues.timestamp

        oracles.forEach(oracle => {
            flightSuretyApp.methods.getMyIndexes().call(
              { from: oracle, gas: gasLimit }, (error, indexes) => {
                  if (error) console.error(error);

                  if (index == indexes[0] || index == indexes[1] || index == indexes[2]) {
                      flightSuretyApp.methods.
                        submitOracleResponse(index, airline, flight, timestamp, statusCode).
                        send({from: oracle, gas: gasLimit}, (error, result) => {
                            console.log(error, result);
                        });
                  }
              });
        });
    });

    flightSuretyApp.events.OracleReport({
        fromBlock: 0
      }, function (error, event) {
        if (error) console.log(error)
        console.log(event)
    });

    flightSuretyApp.events.FlightStatusInfo({
        fromBlock: 0
      }, function (error, event) {
        if (error) console.log(error)
        console.log(event)
    });

    flightSuretyData.events.InsureePaid({
        fromBlock: 0
      }, function (error, event) {
        if (error) console.log(error)
        console.log(event)
    });

    flightSuretyData.events.InsuranceBought({
        fromBlock: 0
      }, function (error, event) {
        if (error) console.log(error)
        console.log(event)
    });

    flightSuretyData.events.InsureeCredited({
      fromBlock: 0
    }, function (error, event) {
      if (error) console.log(error)
      console.log(event)
  });

})();


const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


