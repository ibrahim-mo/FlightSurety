import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json'
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.initialize(config.dataAddress, callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flight_timestamps = [];
        this.gasLimit = 3000000;
    }

    initialize(dataAddress, callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            console.log('Regsitering airlines and depositing antes...')

            let airlines = this.airlines;
            // first airline is already registered during construction,
            // but it must put a stake of 10 ether
            this.isFunded(airlines[0], (error, funded) => {
                if (error) console.error(error);
                if (!funded) {
                    this.web3.eth.sendTransaction({
                        from: airlines[0],
                        to: dataAddress,
                        value: this.web3.utils.toWei('10', 'ether')
                    });
                }
            });

            // next three airlines can be registered by any registered airline,
            // lets use first airline
            for (let i=1; i<4; i++) {
                this.isAirline(airlines[i], (error, registered) => {
                    if (error) console.error(error);
                    if (!registered) {
                        this.registerAirline(airlines[i], airlines[0], (error, result) => {
                            if (error) console.error(error);
                        });
                    }
                });
                this.isFunded(airlines[i], (error, funded) => {
                    if (error) console.error(error);
                    if (!funded) {
                        // each airline must put a stake
                        this.web3.eth.sendTransaction({
                            from: airlines[i],
                            to: dataAddress,
                            value: this.web3.utils.toWei('10', 'ether')
                        });
                    }
                });
            }

            // fifth airline requires multiparty consense of 50%; i.e. two votes,
            // lets use first and second airlines
            this.isAirline(airlines[4], (error, registered) => {
                if (error) console.error(error);
                if (!registered) {
                    for (let j=0; j<2; j++) {
                        this.registerAirline(airlines[4], airlines[j], (error, result) => {
                            if (error) console.error(error);
                        });
                    }
                }
            });
            this.isFunded(airlines[4], (error, funded) => {
                if (error) console.error(error);
                if (!funded) {
                    // fifth airline must put a stake
                    this.web3.eth.sendTransaction({
                        from: airlines[4],
                        to: dataAddress,
                        value: this.web3.utils.toWei('10', 'ether')
                    });
                }
            });

            console.log('Regsitering flights...')

            // Register flights with assigned airlines and timestamps
            let flights = document.getElementById('flight-number').options;
            let init_ts = Math.floor(Date.now() / 1000);
            let increment_ts = 15 * 60; // every 15 mins
            for (let i=0; i < flights.length; i++) {
                // flights[i]: flight ID; flight index; airline index
                let words = flights[i].value.split(';')
                let flight = words[0];
                let flight_index = parseInt(words[1]);
                let airline_index = parseInt(words[2]);
                let airline = airlines[airline_index];
                let timestamp = init_ts + flight_index * increment_ts;

                this.isFlight(airline, flight, timestamp, (error, isFlight) => {
                    if (error) console.error(error);
                    if (!isFlight) {
                        this.registerFlight(airline, flight, timestamp, (error, result) => {
                            if (error) console.error(error);
                            else {
                                this.flight_timestamps.push(timestamp);
                                // console.log(`Flight Registered: ${airline}, ${flight}, ${timestamp}`);
                            }
                        });
                    }
                });
            }

            callback();
        });
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    isAirline(airline, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isAirline(airline)
            .call({ from: self.owner}, callback);
    }

    isFunded(airline, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isFunded(airline)
            .call({ from: self.owner}, callback);
    }

    registerAirline(airline, fromAddress, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .registerAirline(airline)
            .send({ from: fromAddress}, callback);
    }

    isFlight(airline, flight, timestamp, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isFlight(airline, flight, timestamp)
            .call({ from: self.owner}, callback);
    }

    registerFlight(airline, flight, timestamp, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .registerFlight(airline, flight, timestamp)
            .send({ from: self.owner, gas: self.gasLimit }, callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        // flight: flight ID; flight index; airline index 
        let words = flight.split(';')
        let flight_id = words[0];
        let flight_index = parseInt(words[1]);
        let airline_index = parseInt(words[2]);

        let payload = {
            airline: self.airlines[airline_index],
            flight: flight_id,
            timestamp: self.flight_timestamps[flight_index]
        }
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
        // check flight status after 3 seconds
        let delay = 3000;
        let statusCodeMap = {
            0: 'Status Unknown',
            10: 'On Time',
            20: 'Late Airline',
            30: 'Late Weather',
            40: 'Late Technical',
            50: 'Late Other'
        }
        setTimeout(function() {
            self.flightSuretyApp.methods
            .getFlightStatusCode(payload.airline, payload.flight, payload.timestamp)
            .call({ from: self.owner}, (error, statusCode) => {
                if (error) console.error(error);
                document.getElementById('flight-status').innerText = statusCodeMap[statusCode];
            });
        }, delay);
    }

    buy(flight, passenger_id, amount, callback) {
        let self = this;
        // flight: flight ID; flight index; airline index 
        let words = flight.split(';')
        let flight_id = words[0];
        let flight_index = parseInt(words[1]);
        let airline_index = parseInt(words[2]);
        let passenger_index = parseInt(passenger_id);
        let amountInWei = Math.floor(parseFloat(amount) * 1e18);

        let payload = {
            airline: self.airlines[airline_index],
            flight: flight_id,
            timestamp: self.flight_timestamps[flight_index],
            from: self.passengers[passenger_index],
            value: amountInWei
        }
        self.flightSuretyData.methods
            .buy(payload.airline, payload.flight, payload.timestamp)
            .send({ from: payload.from, value: payload.value, gas: self.gasLimit },
                (error, result) => {
                    callback(error, payload);
                });
    }

    pay(passenger_id, callback) {
        let self = this;
        let passenger_index = parseInt(passenger_id);

        let payload = {
            from: self.passengers[passenger_index]
        }
        self.flightSuretyData.methods
            .pay()
            .send({ from: payload.from}, (error, result) => {
                    callback(error, payload);
                });
    }

}