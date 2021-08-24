
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                if (error) console.error(error);
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error,
                                                          value: '[' + result.airline + ']: ' + result.flight + ' ' + result.timestamp } ]);
            });
        })

        DOM.elid('buy-insurance').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            let passenger_id = DOM.elid('passenger-id').value;
            let amount = DOM.elid('amount').value;
            // Write transaction
            contract.buy(flight, passenger_id, amount, (error, result) => {
                if (error) console.error(error);
                else console.log(result);
            });
        })

        DOM.elid('pay-credit').addEventListener('click', () => {
            let passenger_id = DOM.elid('passenger-id').value;
            // Write transaction
            contract.pay(passenger_id, (error, result) => {
                if (error) console.error(error);
                else console.log(result);
            });
        })
    
    });
    

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}
