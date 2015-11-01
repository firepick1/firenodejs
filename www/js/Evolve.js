var firepick;
(function(firepick) {
    function mutateDefault(value, minValue, maxValue) {
        // generate new value in given range with median==value 
        // using approximately Gaussian distribution
        assert.ok(minValue <= value);
        assert.ok(value <= maxValue);
        var r = (Math.random() + Math.random() + Math.random()) / 3;
        assert.ok(0 <= r && r <= 1);
        var result = value;
        if (r < 0.5) {
            result = minValue + (value - minValue) * 2 * r;
        } else {
            result = value + (maxValue - value) * (2 * r - 1);
        }
        assert.ok(minValue <= result);
        assert.ok(result <= maxValue);
        return result;
    }

    function Evolve(generate, compare) {
        assert.ok(generate);
        this.generate = generate;
        this.compare = compare;
        this.mutate = mutateDefault;
        this.nElite = 1;
        this.nSurvivors = 20;
        this.generation = [];
        return this;
    };
    Evolve.prototype.withMutate = function(mutate) {
        assert.ok(mutate instanceof Function);
        this.mutate = mutate;
        return this;
    };
    Evolve.prototype.withElite = function(nElite) {
        assert.ok(nElite >= 1);
        this.nElite = nElite;
        return this;
    };
    Evolve.prototype.withSurvivors = function(nSurvivors) {
        assert.ok(nSurvivors >= 1);
        this.nSurvivors = nSurvivors;
        return this;
    }
    Evolve.prototype.evolve1 = function(generation) {
        var generation1 = generation ? generation : this.generation;
        var generation2 = [];
        for (var i = 0; i < Math.min(generation.length, this.nElite); i++) {
            generation2.push(generation1[i]);
        }
        var variantMap = {};
        for (var iv1 = 0; iv1 < generation1.length; iv1++) {
            var v = generation1[iv1];
            var iv2 = Math.round(Math.random() * 7919) % Math.min(generation.length, this.nSurvivors);
            var parent1 = generation[Math.min(iv1, iv2)];
            var parent2 = generation[Math.max(iv1, iv2)];
            var candidates = this.generate(parent1, parent2, mutateDefault);
            for (var ic = 0; ic < candidates.length; ic++) {
                var c = candidates[ic];
                var key = JSON.stringify(c);
                if (!variantMap[key]) {
                    variantMap[key] = c;
                    generation2.push(c);
                }
            }
        }
        if (this.compare) {
            generation2.sort(this.compare);
        }
        return generation2;
    };
    Evolve.prototype.solve = function(generation, isDone) {
        this.generation = generation;
        assert.ok(isDone instanceof Function);
        for (this.iGeneration = 0;
            (this.status = isDone(this.iGeneration, this.generation)) === false; this.iGeneration++) {
            this.generation = this.evolve1(this.generation);
            if (this.nSurvivors && this.generation.length > this.nSurvivors) {
                this.generation.splice(this.nSurvivors, this.generation.length);
            }
        }
        return this.generation;
    };
    firepick.Evolve = Evolve;
    console.log("firepick.Evolve defined");
})(firepick || (firepick = {}));


var firepick;
(function(firepick) {
    var N = 200;
    var N2 = N == 2 ? 2 : N / 2

    function isDone(n, generation) {
        if (Math.abs(N - generation[0] * generation[0]) < N / 1000) {
            console.log("Solved in " + n + " generations: " + generation[0]);
            return true;
        }
        if (n >= 100) {
            console.log("Giving up after " + n + " generations");
            return true;
        }
        return false;
    };

    function generate(parent1, parent2, mutate) {
        var kids = [mutate(parent1, 1, N2)]; // broad search
        if (parent1 === parent2) {
            kids.push(mutate(parent1, 1, N2));
        } else { // deep search
            var spread = Math.abs(parent1 - parent2);
            var low = Math.max(1, parent1 - spread);
            var high = Math.min(N2, parent1 + spread);
            kids.push(mutate(parent1, low, high));
        }

        return kids;
    };

    function compare(a, b) {
        return Math.abs(N - a * a) - Math.abs(N - b * b);
    };
    var self = {
        testAll: function(result, scope) {
            var evolve = new firepick.Evolve(generate, compare);
            assert.equal(1.5, 3 / 2);
            assert.ok(compare(1.4, 1) < 0);
            assert.ok(compare(1.4, 1.41) > 0);
            assert.ok(compare(1.4, 1.4) == 0);
            var guess1 = (1 + N2) / 2;
            console.log("guess1:" + guess1);
            for (var i = 0; i < 10; i++) {
                var vSolve = evolve.withElite(1).withSurvivors(10).solve([guess1], isDone);
                console.log("Last generation:" + JSON.stringify(vSolve));
                var solution = vSolve[0];
                assert.equal(true, evolve.status);
                assert.ok(Math.abs(N - solution * solution) < N / 1000);
            }

            console.log("guess1:" + guess1);
            var solutions = evolve.solve([(1 + N2) / 2], isDone);
            if (evolve.status === true) {
                var solution = solutions[0];
                console.log("The square root of " + N + " is " + solutions[0]);
            } else {
                console.log("No acceptable solution found after " + evolve.iGeneration + " generations");
            };
            console.log("Last generation:" + JSON.stringify(solutions));

            result.outcome = true;
        }
    };

    firepick.EvolveTest = self;
    console.log("firepick.EvolveTest defined: " + JSON.stringify(firepick.EvolveTest));
})(firepick || (firepick = {}));
